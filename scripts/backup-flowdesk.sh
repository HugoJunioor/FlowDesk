#!/usr/bin/env bash
# FlowDesk daily backup — Postgres dump + tar de /opt/flowdesk/app/data
# Rotaciona: mantem ultimos 7 dias.
# Roda como root via cron diario 03:00.
set -euo pipefail

BACKUP_DIR="/opt/flowdesk/backups"
DATA_DIR="/opt/flowdesk/app/data"
DB_CONTAINER="cfo-db-1"
DB_NAME="flowdesk"
DB_USER="flowdesk"
RETENTION_DAYS=7
TS="$(date +%Y%m%d_%H%M%S)"
LOG="${BACKUP_DIR}/backup.log"

mkdir -p "$BACKUP_DIR"
exec >> "$LOG" 2>&1
echo "===== ${TS} backup start ====="

# 1. Postgres dump (.sql.gz)
PG_FILE="${BACKUP_DIR}/db_${TS}.sql.gz"
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$PG_FILE"; then
  SIZE=$(du -h "$PG_FILE" | cut -f1)
  echo "  [ok] postgres dump: ${PG_FILE} (${SIZE})"
else
  echo "  [ERRO] pg_dump falhou"
  rm -f "$PG_FILE"
  exit 1
fi

# 2. Tar do data dir (JSONs do legacy-state + qualquer outro state)
DATA_FILE="${BACKUP_DIR}/data_${TS}.tar.gz"
if tar -czf "$DATA_FILE" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"; then
  SIZE=$(du -h "$DATA_FILE" | cut -f1)
  echo "  [ok] data dir: ${DATA_FILE} (${SIZE})"
else
  echo "  [ERRO] tar falhou"
  exit 1
fi

# 3. Rotacao: deleta backups mais velhos que RETENTION_DAYS
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "data_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

REMAINING=$(ls "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | wc -l)
echo "  [ok] retencao aplicada — ${REMAINING} backups restantes"
echo "===== ${TS} backup done ====="
