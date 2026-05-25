#!/usr/bin/env bash
# Deploy manual a partir do Bitbucket.
#
# Uso: /opt/flowdesk/scripts/deploy.sh [--migrate] [--no-cache]
#   --migrate   Roda knex migrate:latest na API após rebuild
#   --no-cache  Force rebuild sem cache Docker
#
# Detecta automaticamente quais services mudaram (api/web/legacy_state) e
# rebuilda só os necessários. Web continua usando bind mount de /web-dist
# (não rebuilda container, só faz rsync do novo dist).
set -euo pipefail

APP_DIR="/opt/flowdesk/app"
COMPOSE_FILE="$APP_DIR/docker-compose.server.yml"
LOG_FILE="/var/log/flowdesk-deploy.log"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-bitbucket}"

MIGRATE=0
NO_CACHE=""
for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=1 ;;
    --no-cache) NO_CACHE="--no-cache" ;;
    *) echo "Flag desconhecida: $arg"; exit 1 ;;
  esac
done

cd "$APP_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "===== $(date -Iseconds) deploy start ====="

# 1. SHA antes do pull pra detectar o que mudou
SHA_BEFORE=$(git rev-parse HEAD)
echo "[1/4] git pull $REMOTE $BRANCH (atual: ${SHA_BEFORE:0:7})..."
git fetch "$REMOTE"
git reset --hard "$REMOTE/$BRANCH"
SHA_AFTER=$(git rev-parse HEAD)
echo "  HEAD agora: ${SHA_AFTER:0:7}"

if [ "$SHA_BEFORE" = "$SHA_AFTER" ]; then
  echo "  Nada mudou — sem deploy."
  exit 0
fi

# 2. Detecta quais services foram afetados
CHANGED=$(git diff --name-only "$SHA_BEFORE" "$SHA_AFTER")
echo "[2/4] Mudancas:"
echo "$CHANGED" | sed 's/^/  /'

NEED_API=0; NEED_WEB=0; NEED_LEGACY=0; NEED_MIGRATIONS=0
echo "$CHANGED" | while read -r f; do :; done  # ensure pipe doesn't reset
if echo "$CHANGED" | grep -qE '^apps/api/|^package(-lock)?\.json'; then NEED_API=1; fi
if echo "$CHANGED" | grep -qE '^apps/web/|^nginx/'; then NEED_WEB=1; fi
if echo "$CHANGED" | grep -qE '^legacy-state/'; then NEED_LEGACY=1; fi
if echo "$CHANGED" | grep -qE '^apps/api/src/database/migrations/'; then NEED_MIGRATIONS=1; fi

# 3. Rebuild seletivo
echo "[3/4] Rebuildando services afetados..."

if [ "$NEED_API" = "1" ]; then
  echo "  -> api (build $NO_CACHE + recreate)"
  docker compose -f "$COMPOSE_FILE" build $NO_CACHE api
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate api
fi

if [ "$NEED_LEGACY" = "1" ]; then
  echo "  -> legacy_state (build $NO_CACHE + recreate)"
  docker compose -f "$COMPOSE_FILE" build $NO_CACHE legacy_state
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate legacy_state
fi

if [ "$NEED_WEB" = "1" ]; then
  echo "  -> web (rebuild do dist via bind mount, sem rebuildar container)"
  TMP_BUILD=/opt/flowdesk/app/tmp-build-deploy
  rm -rf "$TMP_BUILD" && mkdir -p "$TMP_BUILD"
  docker run --rm \
    -v "$APP_DIR":/src:ro \
    -v "$TMP_BUILD":/out \
    -w /work \
    node:20-alpine sh -c '
      cp -r /src/package.json /src/package-lock.json /work/ && \
      mkdir -p /work/apps/web && cp -r /src/apps/web/* /work/apps/web/ && \
      cd /work && npm ci --legacy-peer-deps --workspace=@flowdesk/web --include-workspace-root --no-audit --no-fund >/dev/null 2>&1 && \
      cd /work/apps/web && npm run build >/dev/null 2>&1 && \
      cp -r /work/apps/web/dist/* /out/
    '
  if [ -f "$TMP_BUILD/index.html" ]; then
    rsync -a "$TMP_BUILD"/ /opt/flowdesk/app/web-dist/
    find /opt/flowdesk/app/web-dist/assets -type f -mmin +120 -delete 2>/dev/null || true
    echo "    rsync OK"
  else
    echo "    [ERRO] build do web falhou — dist nao gerado"
    rm -rf "$TMP_BUILD"
    exit 1
  fi
  rm -rf "$TMP_BUILD"
fi

# 4. Migrations
if [ "$NEED_MIGRATIONS" = "1" ] || [ "$MIGRATE" = "1" ]; then
  echo "[4/4] Rodando migrations..."
  if [ -f "$APP_DIR/knexfile.production.cjs" ]; then
    docker cp "$APP_DIR/knexfile.production.cjs" flowdesk-api:/app/knexfile.production.cjs
    docker exec -w /app flowdesk-api node_modules/.bin/knex \
      --knexfile knexfile.production.cjs migrate:latest
  else
    echo "  [WARN] knexfile.production.cjs nao encontrado em $APP_DIR — pulando"
  fi
else
  echo "[4/4] Sem migrations novas (use --migrate pra forcar)."
fi

echo "===== $(date -Iseconds) deploy concluido (${SHA_AFTER:0:7}) ====="
