FROM node:18-bullseye-slim AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:18-bullseye-slim AS runtime
WORKDIR /usr/src/app
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  chromium \
  ca-certificates \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libxss1 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/chromium /usr/bin/chrome || true

COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund

COPY --from=builder /usr/src/app/dist ./dist
RUN ln -s dist/backend/cloudnode.js cloudnode.js || true

ENV NODE_ENV=production
ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN mkdir -p /usr/src/app/jobsdb_scrape_results
EXPOSE 3000
CMD ["npm","start"]
