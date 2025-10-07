// Brief: Express webserver serving frontend, SSE stream, and launching scraper processes
import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

let connectLivereload: any = null;
if (process.env.LIVERELOAD === 'true') {
  try {
    connectLivereload = require('connect-livereload');
  } catch (e) {
    // intentionally empty
  }
}

const app = express();
if (connectLivereload) {
  app.use(connectLivereload({ src: '/livereload.js?snipver=1' }));
}
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/dist', express.static(path.join(__dirname, '.')));

const htmlPath = path.join(__dirname, 'index.html');
const mainRoutes = ['/', '/result.html', '/analysis.html', '/setting.html'];
mainRoutes.forEach(route => {
  app.get(route, (req, res) => res.sendFile(htmlPath));
});

const sseClients = new Map<string, express.Response>();

function sendSSEEvent(token: string, event: string, data: any): void {
  const client = sseClients.get(token);
  if (client) {
    try {
      client.write(`event: ${event}\n`);
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(`Failed to send SSE event ${event}:`, err);
    }
  }
}

function closeSSEConnection(token: string): void {
  const client = sseClients.get(token);
  if (client) {
    try {
      client.end();
    } catch (err) {
      console.error('Failed to close SSE connection:', err);
    }
    sseClients.delete(token);
  }
}

app.get('/scrape/stream', (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).send('token required');

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

    let pagesArg = numPages;
    if (pagesMode === 'max') pagesArg = 'all';

    const resultsDir = path.join(__dirname, '../jobsdb_scrape_results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const projectRoot = path.join(__dirname, '..');
    const compiledScraper = path.join(__dirname, '../dist/backend/scrape_jobsdb.js');
    const sourceScraper = path.join(__dirname, '../src/backend/scrape_jobsdb.ts');

    let child;
    if (fs.existsSync(compiledScraper)) {
      const jsArgs = [compiledScraper, 'scrape', '-r', region, '-n', String(pagesArg), '-s', resultsDir];
      if (keywords && keywords.trim().length > 0) jsArgs.push('--keywords', keywords);
      child = spawn('node', jsArgs, { cwd: projectRoot, env: process.env });
    } else if (fs.existsSync(sourceScraper)) {
      const tsArgs = ['-r', 'ts-node/register', sourceScraper, 'scrape', '-r', region, '-n', String(pagesArg), '-s', resultsDir];
      if (keywords && keywords.trim().length > 0) tsArgs.push('--keywords', keywords);
      child = spawn(process.execPath, tsArgs, { cwd: projectRoot, env: process.env });
    } else {
      const args = ['dist/backend/scrape_jobsdb.js', 'scrape', '-r', region, '-n', pagesArg, '-s', resultsDir];
      if (keywords && keywords.trim().length > 0) {
        args.push('--keywords');
        args.push(keywords);
      }
      child = spawn('node', args, { cwd: projectRoot, env: process.env });
    }

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      const txt = data.toString();

      const percentMatch = txt.match(/(\d{1,3})\s*%/);
      if (percentMatch) {
        const pct = Math.max(0, Math.min(100, parseInt(percentMatch[1], 10)));
        sendSSEEvent(token, 'progress', { percent: pct, text: txt });
        return;
      }

      const pageMatch = txt.match(/page\s*(?:[:#])?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i) || txt.match(/(\d+)\s*\/\s*(\d+)/);
      if (pageMatch) {
        const cur = parseInt(pageMatch[1], 10);
        const tot = parseInt(pageMatch[2], 10);
        if (tot > 0) {
          const pct = Math.max(0, Math.min(100, Math.round((cur / tot) * 100)));
          sendSSEEvent(token, 'progress', { percent: pct, text: txt });
          return;
        }
      }

      sendSSEEvent(token, 'log', { text: txt });
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        sendSSEEvent(token, 'error', { error: 'Scraper failed', code, stderr });
        closeSSEConnection(token);
        return res.status(500).json({ error: 'Scraper failed', code, stderr });
      }

      const files = fs.readdirSync(resultsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ f, m: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.m - a.m);

      if (files.length === 0) return res.status(500).json({ error: 'No result file produced' });

      const latest = files[0].f;
      const content = fs.readFileSync(path.join(resultsDir, latest), 'utf8');

      sendSSEEvent(token, 'done', { file: latest });
      closeSSEConnection(token);

      return res.json({ file: latest, content });
    });

  } catch (err) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMessage });
  }
});

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
