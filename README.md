# JobsDB-Analyzer

This project is a **derivative work** based on **[krishgalani/jobsdb-scraper](https://github.com/krishgalani/jobsdb-scraper) (MIT LICENSE)**


JobsDB-Analyzer is a lightweight scraper for JobsDB that extracts job IDs, fetches job details via JobsDB APIs, and outputs structured JSON. It includes a local Web UI and early work on LLM-powered analysis and containerized deployment, and is designed to run on modest hardware.

## Roadmap

- [x] Web UI
- [x] Integrated LLM Analysis (Developing)
- [ ] Containerize (Developing)

## Quick Start

Requirements:

- [Node.js 18+](https://nodejs.org/en/download/)

1. Clone the repository

```shell
git clone https://github.com/vincentwun/jobsdb-scraper.git
cd jobsdb-scraper
```

2. Install dependencies and build

```shell
npm install
npm run build
```

3. Run the local web UI

```shell
npm start
```

4. Open http://localhost:3000 in your browser.


5. Verify and Turn off the Server

```shell
# Verify Turn off the Server
pgrep -a node
```

```shell
# Turn off the Server
pkill -f "node dist/server.js"
```

## Warning

This operation is not thread-safe. Do not run multiple instances against the same save directory concurrently.

## How it works

The scraper uses the [Ulixee](https://nodejs.org/en/download/) stack. A small number of local cloud nodes host browser environments. Workers pop pages from a shared queue, parse job IDs from HTML responses, then fetch job details via backend GraphQL endpoints. Results are streamed and written to a local JSON file.

## Credit

Original author: [krishgalani](https://github.com/krishgalani)

## License

MIT — `LICENSE`