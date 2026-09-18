#!/usr/bin/env bash
# Deploy manual a partir do Bitbucket.
#
# Uso: /opt/flowdesk/scripts/deploy.sh [--migrate] [--no-cache]
#   --migrate   Roda knex migrate:latest na API após rebuild
#   --no-cache  Force rebuild sem cache Docker
#
# Detecta automaticamente quais services mudaram (api/web/legacy_state) e
# rebuilda só os necessários. Os três (api, web, legacy_state) seguem o mesmo
# caminho: build da imagem + recreate. O web NÃO usa bind mount — o dist é
# copiado pra dentro da imagem pelo apps/web/Dockerfile.
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
  # O web se deploya como api e legacy_state: rebuild da imagem + recreate.
  #
  # Antes este bloco buildava o dist num container temporario e fazia rsync pra
  # /opt/flowdesk/app/web-dist/. Esse caminho nunca chegou ao usuario: o
  # servico `web` do docker-compose.server.yml NAO declara volumes, e o
  # apps/web/Dockerfile copia o dist pra dentro da imagem
  # (COPY --from=build /app/apps/web/dist /usr/share/nginx/html). O rsync
  # atualizava um diretorio que ninguem le.
  #
  # A falha era silenciosa — sem erro, sem log, sem 404. O index.html no disco
  # apontava pro bundle novo, o nginx seguia servindo o antigo de dentro da
  # imagem, e os DADOS continuavam frescos porque vem do /demands-snapshot em
  # runtime, nao do bundle. Em 2026-09-18 descobrimos que producao rodava
  # frontend de 10/09: quatro PRs de web tinham "deployado" sem efeito.
  echo "  -> web (build $NO_CACHE + recreate)"
  docker compose -f "$COMPOSE_FILE" build $NO_CACHE web
  docker compose -f "$COMPOSE_FILE" up -d --no-build --force-recreate web

  # Verifica o que o nginx PASSOU A SERVIR, nao o que esta no disco. Foi a
  # ausencia exatamente desta checagem que deixou o problema acima passar.
  SERVED=$(docker exec flowdesk-web \
    grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' /usr/share/nginx/html/index.html 2>/dev/null | head -1)
  if [ -n "$SERVED" ]; then
    echo "    servindo: $SERVED"
  else
    echo "    [AVISO] nao foi possivel ler o bundle servido — confira o container web"
  fi
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
