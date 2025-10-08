# JobsDB Analyzer

An interactive web application to scrape and analyze JobsDB job postings. The project collects job data, runs semantic analyses (using Google Gemini and LangChain workflows), and presents results with charts, tables and summaries to help you understand demand for skills, certifications, experience and locations.

## Highlights

- Easy local setup for quick analysis
- Built-in web UI for exploring results
- Extensible analysis pipeline (Gemini + LangChain)
- Supports saving and re-loading JSON scrape results

## Quick Start (local)

Prerequisites

- Node.js 18+
- npm

1. Clone and enter the repo

```bash
git clone https://github.com/vincentwun/jobsdb-analyzer.git
cd jobsdb-analyzer
```

2. Install and build

```bash
npm install
npm run build
```

3. Start the server and open the UI

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

4. Stop the server (when you're done)

```bash
# show node processes
pgrep -a node

# stop the server process (example)
pkill -f "node dist/server.js"
```

## Docker (optional)

If you prefer to run the app inside a container, build and run the provided Dockerfile. The image bundles the built app and serves the UI.

```bash
# build image (from repo root)
docker build -t jobsdb-analyzer:latest .

# run container, mapping port 3000
docker run -p 3000:3000 --rm jobsdb-analyzer:latest
```

Then open <http://localhost:3000>.

## How it works (high-level)

1. Scraper processes JobsDB pages and extracts job IDs and details.
2. Scraped JSON results are saved under `jobsdb_scrape_results/`.
3. The frontend loads result files and sends data to the analysis pipeline.
4. AI-powered analysis (Google Gemini, or LangChain agents) aggregates skills, certifications, experience, and location insights.
5. Results are visualized in charts, tables and text summaries in the web UI.

## Roadmap

Completed

- ✅ Web UI
- ✅ Integrated AI Analysis (Gemini)
- ✅ Integrated Agent Workflow (LangChain)
- ✅ Containerize

In progress

- 🟦 Integrated AI Analysis (Ollama)
- 🟦 Integrated PostgreSQL

## Credits

Built from and adapted with improvements on top of [krishgalani/jobsdb-scraper](https://github.com/krishgalani/jobsdb-scraper). Thanks to the original author of the upstream project.

## License

MIT
