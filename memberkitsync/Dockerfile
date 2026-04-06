# ── base: shared deps install ──────────────────────────────────────────────────
FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# ── development: hot-reload via tsx watch ──────────────────────────────────────
FROM base AS development
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
CMD ["npx", "tsx", "watch", "src/server.ts"]

# ── builder: compile TypeScript ────────────────────────────────────────────────
FROM base AS builder
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── production: minimal image, only compiled output + prod deps ────────────────
FROM node:24-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
