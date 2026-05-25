#!/bin/bash
# Sincroniza demandas do Slack a cada N min e atualiza /opt/flowdesk/app/web-dist.
#
# Diferenca pro fluxo antigo: NAO rebuilda o container Docker. Em vez disso,
# faz rsync sem --delete pra preservar chunks antigos (URLs com hash) e
# manter abas abertas funcionando ate que reloadem naturalmente.
#
# - md5(realDemands.ts) muda => roda build do frontend e rsync
# - chunks antigos com mais de 2h em /opt/flowdesk/app/web-dist/assets/
#   sao deletados (garbage collect)
set -e
cd /opt/flowdesk/app

LOG=/var/log/flowdesk-sync.log
DATA_FILE=apps/web/src/data/realDemands.ts
DIST_DIR=/opt/flowdesk/app/web-dist
TMP_BUILD=/opt/flowdesk/app/tmp-build

HASH_BEFORE=$(md5sum $DATA_FILE 2>/dev/null | awk '{print $1}' || echo "none")

echo "===== $(date -Iseconds) sync iniciado =====" >> $LOG

# Sync Slack -> realDemands.ts
docker run --rm \
  -v /opt/flowdesk/app:/app \
  -w /app \
  --env-file /opt/flowdesk/app/.env \
  --network app_network \
  node:20-alpine sh -c '
    cd /app && npm install --no-save --legacy-peer-deps @slack/web-api dotenv >/dev/null 2>&1 && \
    cd apps/web && node scripts/syncSlack.cjs
  ' >> $LOG 2>&1

HASH_AFTER=$(md5sum $DATA_FILE | awk '{print $1}')

if [ "$HASH_BEFORE" != "$HASH_AFTER" ]; then
  echo "Dados mudaram — buildando frontend e fazendo rsync..." >> $LOG

  # Build do frontend num container temp (sem rebuildar a imagem nginx).
  # Output vai pra /opt/flowdesk/app/tmp-build/dist
  rm -rf "$TMP_BUILD"
  mkdir -p "$TMP_BUILD"

  docker run --rm \
    -v /opt/flowdesk/app:/src:ro \
    -v "$TMP_BUILD":/out \
    -w /work \
    node:20-alpine sh -c '
      cp -r /src/package.json /src/package-lock.json /work/ && \
      mkdir -p /work/apps/web && cp -r /src/apps/web/* /work/apps/web/ && \
      cd /work && npm ci --legacy-peer-deps --workspace=@flowdesk/web --include-workspace-root --no-audit --no-fund >/dev/null 2>&1 && \
      cd /work/apps/web && npm run build >/dev/null 2>&1 && \
      cp -r /work/apps/web/dist/* /out/
    ' >> $LOG 2>&1

  if [ ! -f "$TMP_BUILD/index.html" ]; then
    echo "  [ERRO] build falhou — index.html nao gerado, mantendo dist atual" >> $LOG
    rm -rf "$TMP_BUILD"
    exit 1
  fi

  # rsync SEM --delete: chunks antigos sobrevivem pra abas abertas
  rsync -a "$TMP_BUILD"/ "$DIST_DIR"/ >> $LOG 2>&1
  echo "  [ok] rsync concluido" >> $LOG

  # Garbage collect: assets com mtime > 2h sao apagados
  # (chunks novos acabaram de ser criados, tem mtime atual)
  find "$DIST_DIR/assets" -type f -mmin +120 -delete 2>/dev/null || true
  REMAINING=$(ls "$DIST_DIR/assets" 2>/dev/null | wc -l)
  echo "  [ok] gc: $REMAINING assets ativos" >> $LOG

  rm -rf "$TMP_BUILD"
else
  echo "Sem mudancas — sem build" >> $LOG
fi
