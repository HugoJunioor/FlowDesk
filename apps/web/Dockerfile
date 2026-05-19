# Multi-stage build do frontend FlowDesk.
# Stage 1: build (Vite gera apps/web/dist).
# Stage 2: nginx alpine serve o build estatico.

# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Copia manifests do monorepo (workspace) — precisa do root + apps/web pra
# o npm install --workspaces funcionar.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

RUN npm ci --legacy-peer-deps --workspace=@flowdesk/web --include-workspace-root

# Copia o resto do codigo da web (so o necessario pra build)
COPY apps/web ./apps/web

# Build args injetados pelo CI (opcional)
ARG VITE_BUILD_SHA=""
ARG VITE_BUILD_DATE=""
ENV VITE_BUILD_SHA=$VITE_BUILD_SHA
ENV VITE_BUILD_DATE=$VITE_BUILD_DATE
# Em prod a API e servida no MESMO dominio — frontend chama com path relativo.
ENV VITE_FLOWDESK_API_URL=""

RUN npm run build -w @flowdesk/web

# ─── Stage 2: serve ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

# Config do nginx interno (SPA fallback + cache de assets imutaveis)
COPY nginx/web.conf /etc/nginx/conf.d/default.conf

# Build estatico
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck para o Traefik nao subir antes do nginx
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
