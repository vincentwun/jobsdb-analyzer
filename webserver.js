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

app.post('/scrape', async (req, res) => {
  try {
    const { region, pagesMode, numPages, keywords } = req.body;
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
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
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
