# FlowDesk API — multi-stage build (monorepo npm workspaces)
#
# Build context: RAIZ do monorepo (precisa do package-lock.json + apps/api).
# Em docker-compose.server.yml: context: . / dockerfile: apps/api/Dockerfile

# ─── Stage 1: deps ──────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copia manifests do workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm ci --legacy-peer-deps --workspace=@flowdesk/api --include-workspace-root

# ─── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# npm workspaces hospedam node_modules so na raiz — apps/api nao tem o seu
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api

RUN npm run build -w @flowdesk/api

# ─── Stage 3: runner (prod) ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Usuario nao-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 flowdesk

# Copia so o necessario pra rodar (sem dev deps)
COPY --from=build --chown=flowdesk:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=flowdesk:nodejs /app/apps/api/package.json ./
COPY --from=build --chown=flowdesk:nodejs /app/node_modules ./node_modules

USER flowdesk

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
