
import express from "express";
import path from "path";
import { spawn } from "child_process";
import fs from "fs";

// Summary: Simple web server that serves the frontend, provides an SSE stream for scraper progress, and runs the scraper as a child process.
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distPath = fs.existsSync(path.join(__dirname, "react-app.js"))
  ? path.join(__dirname, ".")
  : path.join(__dirname, "..", "dist");
app.use("/dist", express.static(distPath));

const distIndex = path.join(__dirname, "..", "dist", "index.html");
const publicIndex = path.join(__dirname, "..", "public", "index.html");
const htmlPath = fs.existsSync(distIndex)
  ? distIndex
  : fs.existsSync(publicIndex)
  ? publicIndex
  : path.join(__dirname, "index.html");

const mainRoutes = ["/", "/result.html", "/analysis.html", "/setting.html"];
mainRoutes.forEach((route) => {
  app.get(route, (req, res) => res.sendFile(htmlPath));
});

const sseClients = new Map<string, express.Response>();

// sendSSEEvent: Send a Server-Sent Event with JSON data to the client identified by token.
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

// closeSSEConnection: Close SSE connection and remove the client from the map.
function closeSSEConnection(token: string): void {
  const client = sseClients.get(token);
  if (client) {
    try {
      client.end();
    } catch (err) {
      console.error("Failed to close SSE connection:", err);
    }
    sseClients.delete(token);
  }
}

// GET /scrape/stream: Open an SSE stream so a client can receive scraper events using the token query.
app.get("/scrape/stream", (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).send("token required");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");
  sseClients.set(token, res);

  req.on("close", () => {
    sseClients.delete(token);
  });
});

// POST /scrape: Start the scraper as a child process and forward its logs and progress to the client via SSE.
app.post("/scrape", async (req, res) => {
  try {
    const { region, pagesMode, numPages, keywords, token } = req.body;

    let pagesArg = numPages;
    if (pagesMode === "max") pagesArg = "all";

    const resultsDir = path.join(__dirname, "../jobsdb_scrape_results");
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const projectRoot = path.join(__dirname, "..");
    const compiledScraper = path.join(__dirname, "../dist/backend/scrape_jobsdb.js");
    const sourceScraper = path.join(__dirname, "../src/backend/scrape_jobsdb.ts");

    let child;
    if (fs.existsSync(compiledScraper)) {
      const jsArgs = [
        compiledScraper,
        "scrape",
        "-r",
        region,
        "-n",
        String(pagesArg),
        "-s",
        resultsDir,
      ];
      if (keywords && keywords.trim().length > 0) jsArgs.push("--keywords", keywords);
      child = spawn("node", jsArgs, { cwd: projectRoot, env: process.env });
    } else if (fs.existsSync(sourceScraper)) {
      const tsArgs = [
        "-r",
        "ts-node/register",
        sourceScraper,
        "scrape",
        "-r",
        region,
        "-n",
        String(pagesArg),
        "-s",
        resultsDir,
      ];
      if (keywords && keywords.trim().length > 0) tsArgs.push("--keywords", keywords);
      child = spawn(process.execPath, tsArgs, { cwd: projectRoot, env: process.env });
    } else {
      const args = [
        "dist/backend/scrape_jobsdb.js",
        "scrape",
        "-r",
        region,
        "-n",
        pagesArg,
        "-s",
        resultsDir,
      ];
      if (keywords && keywords.trim().length > 0) {
        args.push("--keywords");
        args.push(keywords);
      }
      child = spawn("node", args, { cwd: projectRoot, env: process.env });
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      const txt = data.toString();

      const percentMatch = txt.match(/(\d{1,3})\s*%/);
      if (percentMatch) {
        const pct = Math.max(0, Math.min(100, parseInt(percentMatch[1], 10)));
        sendSSEEvent(token, "progress", { percent: pct, text: txt });
        return;
      }

      const pageMatch = txt.match(/page\s*(?:[:#])?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i) || txt.match(/(\d+)\s*\/\s*(\d+)/);
      if (pageMatch) {
        const cur = parseInt(pageMatch[1], 10);
        const tot = parseInt(pageMatch[2], 10);
        if (tot > 0) {
          const pct = Math.max(0, Math.min(100, Math.round((cur / tot) * 100)));
          sendSSEEvent(token, "progress", { percent: pct, text: txt });
          return;
        }
      }

      sendSSEEvent(token, "log", { text: txt });
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        sendSSEEvent(token, "error", { error: "Scraper failed", code, stderr });
        closeSSEConnection(token);
        return res.status(500).json({ error: "Scraper failed", code, stderr });
      }

      const files = fs
        .readdirSync(resultsDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({ f, m: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.m - a.m);

      if (files.length === 0) return res.status(500).json({ error: "No result file produced" });

      const latest = files[0].f;
      const content = fs.readFileSync(path.join(resultsDir, latest), "utf8");

      sendSSEEvent(token, "done", { file: latest });
      closeSSEConnection(token);

      return res.json({ file: latest, content });
    });
  } catch (err) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMessage });
  }
});

// GET /results/:file: Return a saved scrape result JSON file if it exists.
app.get("/results/:file", (req, res) => {
  try {
    const resultsDir = path.join(__dirname, "../jobsdb_scrape_results");
    const file = req.params.file;
    const filePath = path.join(resultsDir, file);
    if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
    return res.sendFile(filePath);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return res.status(500).send(errorMessage);
  }
});

// GET /results: Return list of available result JSON files sorted by modification time.
app.get("/results", (req, res) => {
  try {
    const resultsDir = path.join(__dirname, "../jobsdb_scrape_results");
    if (!fs.existsSync(resultsDir)) return res.json([]);
    const files = fs
      .readdirSync(resultsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        f,
        m: fs.statSync(path.join(resultsDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.m - a.m)
      .map((x) => x.f);
    return res.json(files);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errorMessage });
  }
});

// Start the webserver.
// Start the webserver.
app.listen(PORT, () =>
  console.log(`Webserver listening on http://localhost:${PORT}`)
);
