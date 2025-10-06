FROM node:22.20.0-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22.20.0-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

RUN mkdir -p /app/jobsdb_scrape_results

EXPOSE 3000

CMD ["node", "dist/server.js"]