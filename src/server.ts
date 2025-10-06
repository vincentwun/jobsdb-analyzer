import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
// only require connect-livereload in dev time to avoid adding a runtime dep in prod
let connectLivereload: any = null;
if (process.env.LIVERELOAD === 'true') {
  try { connectLivereload = require('connect-livereload'); } catch (e) { /* ignore */ }
}

const app = express();
if (connectLivereload) {
  app.use(connectLivereload({ src: '/livereload.js?snipver=1' }));
}
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve compiled frontend assets from dist
app.use('/dist', express.static(path.join(__dirname, '.')));

// Serve React app for all main routes
const htmlPath = path.join(__dirname, 'index.html');
app.get('/', (req, res) => {
  return res.sendFile(htmlPath);
});
app.get('/result.html', (req, res) => {
  return res.sendFile(htmlPath);
});
app.get('/analysis.html', (req, res) => {
  return res.sendFile(htmlPath);
});
app.get('/setting.html', (req, res) => {
  return res.sendFile(htmlPath);
});

// Simple SSE client registry keyed by token
const sseClients = new Map<string, express.Response>();

// SSE endpoint for progress updates. Client should connect with ?token=XYZ
app.get('/scrape/stream', (req, res) => {
  const token = req.query.token as string;
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
    const { region, pagesMode, numPages, keywords, token } = req.body;
    
    // Determine pages arg
    let pagesArg = numPages;
    if (pagesMode === 'max') pagesArg = 'all';
    
    // Ensure output dir
    const resultsDir = path.join(__dirname, '../jobsdb_scrape_results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    // Build CLI args
    const args = ['dist/backend/scrape_jobsdb.js', 'scrape', '-r', region, '-n', pagesArg, '-s', resultsDir];
    if (keywords && keywords.trim().length > 0) {
      args.push('--keywords');
      args.push(keywords);
    }

    // Prefer running compiled dist if available, otherwise run the TypeScript source via ts-node
    const projectRoot = path.join(__dirname, '..');
    const compiledScraper = path.join(__dirname, '../dist/backend/scrape_jobsdb.js');
    const sourceScraper = path.join(__dirname, '../src/backend/scrape_jobsdb.ts');

    let child;
    if (fs.existsSync(compiledScraper)) {
      // use compiled JS
      const jsArgs = [compiledScraper, 'scrape', '-r', region, '-n', String(pagesArg), '-s', resultsDir];
      if (keywords && keywords.trim().length > 0) {
        jsArgs.push('--keywords', keywords);
      }
      child = spawn('node', jsArgs, { cwd: projectRoot });
    } else if (fs.existsSync(sourceScraper)) {
      // run via ts-node so dev doesn't require `npm run build`
      const tsArgs = ['-r', 'ts-node/register', sourceScraper, 'scrape', '-r', region, '-n', String(pagesArg), '-s', resultsDir];
      if (keywords && keywords.trim().length > 0) {
        tsArgs.push('--keywords', keywords);
      }
      child = spawn(process.execPath, tsArgs, { cwd: projectRoot, env: process.env });
    } else {
      // fallback to original behavior (may error)
      child = spawn('node', args, { cwd: projectRoot });
    }

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
        if (token && sseClients.has(token)) {
          const client = sseClients.get(token);
          if (client) {
            client.write(`event: error\n`);
            client.write(`data: ${JSON.stringify({ error: 'Scraper failed', code, stderr })}\n\n`);
            try { client.end(); } catch (e) { }
            sseClients.delete(token);
          }
        }
        return res.status(500).json({ error: 'Scraper failed', code, stderr });
      }
      
      // Find latest result file in resultsDir
      const files = fs.readdirSync(resultsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ f, m: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.m - a.m);
        
      if (files.length === 0) return res.status(500).json({ error: 'No result file produced' });
      
      const latest = files[0].f;
      const content = fs.readFileSync(path.join(resultsDir, latest), 'utf8');
      
      // notify SSE client of completion
      if (token && sseClients.has(token)) {
        const client = sseClients.get(token);
        if (client) {
          client.write(`event: done\n`);
          client.write(`data: ${JSON.stringify({ file: latest })}\n\n`);
          try { client.end(); } catch (e) { }
          sseClients.delete(token);
        }
      }
      return res.json({ file: latest, content });
    });

  } catch (err) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMessage });
  }
});

// Serve result files under /results/<filename>
app.get('/results/:file', (req, res) => {
  try {
    const resultsDir = path.join(__dirname, '../jobsdb_scrape_results');
    const file = req.params.file;
    const filePath = path.join(resultsDir, file);
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    return res.sendFile(filePath);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return res.status(500).send(errorMessage);
  }
});

// Return a JSON array of available result files (sorted by mtime desc)
app.get('/results', (req, res) => {
  try {
    const resultsDir = path.join(__dirname, '../jobsdb_scrape_results');
    if (!fs.existsSync(resultsDir)) return res.json([]);
    const files = fs.readdirSync(resultsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ f, m: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.m - a.m)
      .map(x => x.f);
    return res.json(files);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errorMessage });
  }
});

app.listen(PORT, () => console.log(`Webserver listening on http://localhost:${PORT}`));
