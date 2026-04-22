# ── base: deps ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# ── development: hot-reload via next dev ───────────────────────────────────────
FROM base AS development
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--", "-p", "3001"]

# ── builder: compile Next.js (standalone output) ───────────────────────────────
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# ── production: imagem mínima com standalone output ────────────────────────────
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
EXPOSE 3001
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
