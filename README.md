# JobsDB-Analyzer

This project is a **derivative work** base on **[krishgalani](https://github.com/krishgalani/jobsdb-scraper) (MIT LICENSE)**


A lightweight, production-oriented scraper for JobsDB job listings. It collects job IDs from search pages and fetches job details via JobsDB's backend APIs. The project is designed to be efficient and run on commodity hardware.

## Installation

Requirements:

- [Node.js 18+](https://nodejs.org/en/download/)

Quick setup:

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

## How to use

1. Run the local web UI

```shell
npm run start:web
# Or
node webserver.js
```

2. Open http://localhost:3000 in your browser, fill the form and submit. When the scrape completes the page will provide a link to view the generated JSON file.

Notes:
- If you want live reloading during development, install `nodemon` globally and use `npm run dev:web`.

## Warning

This operation is not thread-safe. Do not run multiple instances against the same save directory concurrently.

## How it works

The scraper uses the [Ulixee](https://nodejs.org/en/download/) stack. A small number of local cloud nodes host browser environments. Workers pop pages from a shared queue, parse job IDs from HTML responses, then fetch job details via backend GraphQL endpoints. Results are streamed and written to a local JSON file.

## Credit

Original author: [krishgalani](https://github.com/krishgalani)

## License

MIT — `LICENSE`