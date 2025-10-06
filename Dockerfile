FROM node:18-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji ca-certificates libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxss1 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build || true

RUN npm prune --production || true

RUN mkdir -p /usr/src/app/jobsdb_scrape_results && useradd -m appuser && chown -R appuser:appuser /usr/src/app

USER appuser

EXPOSE 3000

CMD ["npm","start"]