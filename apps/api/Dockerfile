# Just Flow API — Dockerfile multi-stage (monorepo-aware).
#
# Build precisa do root do monorepo porque o api depende de workspaces.
# docker-compose passa context=. e dockerfile=apps/api/Dockerfile.

# ─── Stage 1: deps (instala TUDO incluindo dev pra rodar build) ──────────────
FROM node:20-alpine AS deps

WORKDIR /app

# build-tools pra deps nativas (bcrypt etc.) — removidas no runner.
RUN apk add --no-cache python3 make g++

# Manifests do monorepo (root + apps/api) — necessario pra resolver workspaces.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=@flowdesk/api --include-workspace-root

# ─── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api

RUN npm run build -w @flowdesk/api

# ─── Stage 3: runner (reusa node_modules do build, sem reinstalar) ──────────
# Trade-off: imagem um pouco maior por incluir devDeps, mas elimina
# falha de re-install em alpine sem build-tools. Aceitavel pro escopo atual.
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# User nao-root pra prod
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 flowdesk

COPY --from=build --chown=flowdesk:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=flowdesk:nodejs /app/package.json ./
COPY --from=build --chown=flowdesk:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=flowdesk:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=flowdesk:nodejs /app/apps/api/dist ./apps/api/dist

USER flowdesk

WORKDIR /app/apps/api

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
