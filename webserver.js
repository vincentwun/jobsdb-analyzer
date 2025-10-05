const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple SSE client registry keyed by token
const sseClients = new Map();

// SSE endpoint for progress updates. Client should connect with ?token=XYZ
app.get('/scrape/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('token required');
  // set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');
  sseClients.set(token, res);
  req.on('close', () => {
    sseClients.delete(token);
  });
});

app.post('/scrape', async (req, res) => {
  try {
    const { region, pagesMode, numPages, keywords } = req.body;
    const token = req.body.token;
    // Determine pages arg
    let pagesArg = numPages;
    if (pagesMode === 'max') pagesArg = 'all';
    // Ensure output dir
    const resultsDir = path.join(__dirname, 'jobsdb_scrape_results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    // Build CLI args
    const args = ['build/src/scrape_jobsdb', 'scrape', '-r', region, '-n', pagesArg, '-s', resultsDir];
    if (keywords && keywords.trim().length > 0) {
      args.push('--keywords');
      args.push(keywords);
    }

    const child = spawn('node', args, { cwd: __dirname });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // try to parse progress from stdout
      try {
        const txt = data.toString();
        // look for percent like '12%' or 'Progress: 12%'
        const m = txt.match(/(\d{1,3})\s*%/);
        if (m) {
          const pct = Math.max(0, Math.min(100, parseInt(m[1], 10)));
          const client = token && sseClients.get(token);
          if (client) {
            client.write(`event: progress\n`);
            client.write(`data: ${JSON.stringify({ percent: pct, text: txt })}\n\n`);
          }
        } else {
          // look for page X of Y patterns and convert to percent
          const m2 = txt.match(/page\s*(?:[:#])?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i) || txt.match(/(\d+)\s*\/\s*(\d+)/);
          if (m2) {
            const cur = parseInt(m2[1], 10);
            const tot = parseInt(m2[2], 10);
            if (tot > 0) {
              const pct = Math.max(0, Math.min(100, Math.round((cur / tot) * 100)));
              const client = token && sseClients.get(token);
              if (client) {
                client.write(`event: progress\n`);
                client.write(`data: ${JSON.stringify({ percent: pct, text: txt })}\n\n`);
              }
            }
          } else {
            // send generic log event
            const client = token && sseClients.get(token);
            if (client) {
              client.write(`event: log\n`);
              client.write(`data: ${JSON.stringify({ text: txt })}\n\n`);
            }
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        // notify SSE client of failure
        if (token && sseClients.has(token)){
          const client = sseClients.get(token);
          client.write(`event: error\n`);
          client.write(`data: ${JSON.stringify({ error: 'Scraper failed', code, stderr })}\n\n`);
          try{ client.end(); }catch(e){}
          sseClients.delete(token);
        }
        return res.status(500).json({ error: 'Scraper failed', code, stderr });
      }
      // Find latest result file in resultsDir
      const files = fs.readdirSync(resultsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ f, m: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
        .sort((a,b) => b.m - a.m);
      if (files.length === 0) return res.status(500).json({ error: 'No result file produced' });
      const latest = files[0].f;
      const content = fs.readFileSync(path.join(resultsDir, latest), 'utf8');
      // notify SSE client of completion
      if (token && sseClients.has(token)){
        const client = sseClients.get(token);
        client.write(`event: done\n`);
        client.write(`data: ${JSON.stringify({ file: latest })}\n\n`);
        try{ client.end(); }catch(e){}
        sseClients.delete(token);
      }
      return res.json({ file: latest, content });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

// Serve result files under /results/<filename>
app.get('/results/:file', (req, res) => {
  try {
    const resultsDir = path.join(__dirname, 'jobsdb_scrape_results');
    const file = req.params.file;
    const filePath = path.join(resultsDir, file);
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
});

app.listen(PORT, () => console.log(`Webserver listening on http://localhost:${PORT}`));
