# JobsDB-Analyzer

## Credits

Original author: [krishgalani](https://github.com/krishgalani)

This project is built on top of the excellent open source project **[krishgalani/jobsdb-scraper](https://github.com/krishgalani/jobsdb-scraper)**.

## Overview

JobsDB Analyzer is an interactive web application designed for analyzing JobsDB job data. It automatically scrapes job postings and leverages Google Gemini AI to perform multi-dimensional semantic analysis on skills, certifications, experience, and locations. Analysis results are presented with modern charts, tables, and summaries.

## Roadmap

- [x] Web UI
- [x] Integrated AI Analysis
- [x] Integrated Agent Workflow
- [ ] Containerize

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


## License

MIT — `LICENSE`