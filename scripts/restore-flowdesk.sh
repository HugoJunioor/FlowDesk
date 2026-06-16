#!/usr/bin/env bash
# FlowDesk restore — restaura DB + data dir + sync data a partir de backup escolhido.
# Uso:
#   ./restore-flowdesk.sh <timestamp>
# Onde <timestamp> bate com nomes de arquivo (ex: 20260520_030000).
#
# CUIDADO: substitui DB inteira, data dir e sync dir. Pare a stack antes.
set -euo pipefail

BACKUP_DIR="/opt/flowdesk/backups"
DATA_DIR="/opt/flowdesk/app/data"
SYNC_DIR="/opt/flowdesk/app/apps/web/src/data"
DB_CONTAINER="${DB_CONTAINER:-postgres}"
DB_NAME="${DB_NAME:-flowdesk}"
DB_USER="${DB_USER:-flowdesk}"

if [ $# -lt 1 ]; then
  echo "Uso: $0 <timestamp>"
  echo
  echo "Backups disponiveis:"
  ls "$BACKUP_DIR" 2>/dev/null | grep -E '^(db|data|sync)_' | sort -u | sed 's/^/  /'
  exit 1
fi

TS="$1"
PG_FILE="${BACKUP_DIR}/db_${TS}.sql.gz"
DATA_FILE="${BACKUP_DIR}/data_${TS}.tar.gz"
SYNC_FILE="${BACKUP_DIR}/sync_${TS}.tar.gz"

if [ ! -f "$PG_FILE" ] || [ ! -f "$DATA_FILE" ]; then
  echo "ERRO: backups nao encontrados pro timestamp ${TS}"
  echo "  esperado: ${PG_FILE} e ${DATA_FILE}"
  exit 1
fi
# sync_* eh opcional: backups antigos (pre essa mudanca) nao tem.
if [ ! -f "$SYNC_FILE" ]; then
  echo "AVISO: ${SYNC_FILE} nao existe — restore pulara o sync dir (backup anterior a essa feature)."
fi

echo "ATENCAO: vai sobrescrever DB '${DB_NAME}', dir '${DATA_DIR}' e (se disponivel) dir '${SYNC_DIR}'."
echo "  postgres: ${PG_FILE}"
echo "  data:     ${DATA_FILE}"
if [ -f "$SYNC_FILE" ]; then
  echo "  sync:     ${SYNC_FILE}"
fi
read -r -p "Confirma? (digite 'sim') " CONFIRM
[ "$CONFIRM" = "sim" ] || { echo "cancelado"; exit 1; }

# 1. Para a stack pra liberar conexoes
echo "[1/5] parando stack FlowDesk..."
cd /opt/flowdesk/app && docker compose -f docker-compose.server.yml stop api web legacy_state

# 2. Restore Postgres (drop + create + restore)
echo "[2/5] restaurando Postgres..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"
gunzip -c "$PG_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" > /dev/null

# 3. Restore data dir (move atual pra .bak e extrai)
echo "[3/5] restaurando data dir..."
if [ -d "$DATA_DIR" ]; then
  mv "$DATA_DIR" "${DATA_DIR}.bak.$(date +%s)"
fi
tar -xzf "$DATA_FILE" -C "$(dirname "$DATA_DIR")"

# 4. Restore sync dir (realDemands.ts, historicalDemands.ts, etc) — opcional
if [ -f "$SYNC_FILE" ]; then
  echo "[4/5] restaurando sync dir..."
  if [ -d "$SYNC_DIR" ]; then
    mv "$SYNC_DIR" "${SYNC_DIR}.bak.$(date +%s)"
  fi
  tar -xzf "$SYNC_FILE" -C "$(dirname "$SYNC_DIR")"
else
  echo "[4/5] pulando sync dir (sem backup disponivel)"
fi

# 5. Sobe a stack
echo "[5/5] subindo stack..."
docker compose -f docker-compose.server.yml up -d api web legacy_state

echo "===== restore concluido (${TS}) ====="
echo "dirs antigos movidos pra *.bak.*"
