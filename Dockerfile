FROM node:18-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji ca-certificates libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxss1 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/chromium /usr/bin/chrome

ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN ln -s dist/backend/cloudnode.js cloudnode.js

# 將 NODE_ENV 移到這裡
ENV NODE_ENV=production

RUN npm prune --production

RUN mkdir -p /usr/src/app/jobsdb_scrape_results

EXPOSE 3000

CMD ["npm","start"]
