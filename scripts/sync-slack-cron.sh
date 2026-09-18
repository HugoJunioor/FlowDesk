#!/bin/bash
# Carrega .env (cron tem ambiente limpo). DOCKER_NETWORK, SLACK_BOT_TOKEN, etc.
#
# IMPORTANTE: `. .env` num shell quebra com valores nao-quotados que tem
# caracteres especiais (ex: SMTP_FROM=Just Flow <x@y.com> → erro de parse e,
# com `set -e`, aborta o cron silenciosamente). Por isso parseamos manual:
# - ignora comentarios e linhas vazias
# - aceita valores com `<`, `>`, espacos sem precisar de aspas
# - falhas em uma linha NAO matam o script todo
ENV_FILE=/opt/flowdesk/app/.env
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      ''|\#*) continue ;;
    esac
    # tira aspas em volta do valor se houver
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    export "$key=$value" 2>/dev/null || true
  done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE")
fi

# Sincroniza demandas do Slack a cada N min, escrevendo apps/web/src/data/realDemands.ts.
#
# Escrever o arquivo E a propagacao: o legacy-state monta esse diretorio como
# /web-data e serve o conteudo em /demands-snapshot; o frontend consulta
# /sync-status a cada 30s e troca os dados em memoria quando o mtime muda.
# Nenhum build, nenhum rsync, nenhum container reiniciado.
#
# Mudanca de CODIGO do frontend nao passa por aqui: ela entra por deploy
# (scripts/deploy.sh), que rebuilda a imagem do web. O diretorio web-dist/ e
# residuo de um mecanismo antigo e nao e servido por ninguem — ver o comentario
# do bloco `web` no deploy.sh.
set -e
cd /opt/flowdesk/app

LOG=/var/log/flowdesk-sync.log
DATA_FILE=apps/web/src/data/realDemands.ts

# Teto de recurso do container efemero do sync. Sem isso ele competia de igual
# pra igual com api e legacy_state pela memoria do host, e o kernel matava os
# dois (exit 137) — o Traefik entao removia os routers e tudo caia no nginx.
SYNC_MEM=${SYNC_MEM:-512m}
SYNC_CPUS=${SYNC_CPUS:-1}

# Execucoes nao podem se sobrepor. Sem o build o sync ficou rapido, mas a
# chamada a API do Slack ainda pode se arrastar sob rate limit ou rede ruim — e
# duas execucoes concorrentes escreveriam realDemands.ts ao mesmo tempo, que e
# o arquivo que o legacy-state le pra servir /demands-snapshot.
#
# O teste de disponibilidade do flock nao e zelo excessivo: sem ele, um host
# sem util-linux faria `flock` retornar "command not found" (status != 0), o
# `!` inverteria pra verdadeiro e o script sairia achando que ha outra execucao
# — TODA vez. O sync morreria em silencio, com log dizendo que estava tudo bem.
LOCK=/var/lock/flowdesk-sync.lock
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    echo "===== $(date -Iseconds) sync anterior ainda rodando, pulando =====" >> $LOG
    exit 0
  fi
else
  echo "  [aviso] flock indisponivel — seguindo sem protecao contra sobreposicao" >> $LOG
fi

HASH_BEFORE=$(md5sum $DATA_FILE 2>/dev/null | awk '{print $1}' || echo "none")

echo "===== $(date -Iseconds) sync iniciado =====" >> $LOG

# Sync Slack -> realDemands.ts
#
# O npm install so roda se as deps faltarem, e na pratica elas nunca faltam:
# @slack/web-api e dotenv estao declarados em apps/web/package.json e o npm
# workspaces os iça pra /opt/flowdesk/app/node_modules, que entra aqui pelo
# bind mount. Rodar o install assim mesmo custava ~6 dos ~10 minutos de cada
# execucao — ele refaz a resolucao da arvore inteira do monorepo pra concluir
# que nao ha nada a fazer.
#
# O fallback fica porque o node_modules e do host, nao da imagem: se alguem
# limpar o diretorio ou clonar o repo do zero, o sync precisa se virar sozinho
# em vez de falhar no require.
docker run --rm \
  --memory="$SYNC_MEM" --cpus="$SYNC_CPUS" \
  -v /opt/flowdesk/app:/app \
  -w /app \
  --env-file /opt/flowdesk/app/.env \
  --network "${DOCKER_NETWORK:-cfo_default}" \
  node:20-alpine sh -c '
    cd /app && \
    if [ -d node_modules/@slack/web-api ] && [ -d node_modules/dotenv ]; then \
      echo "  [ok] deps do sync ja presentes — sem npm install"; \
    else \
      echo "  [info] deps do sync ausentes — instalando"; \
      npm install --no-save --legacy-peer-deps @slack/web-api dotenv >/dev/null 2>&1; \
    fi && \
    cd apps/web && node scripts/syncSlack.cjs
  ' >> $LOG 2>&1

HASH_AFTER=$(md5sum $DATA_FILE | awk '{print $1}')

if [ "$HASH_BEFORE" != "$HASH_AFTER" ]; then
  # Nao ha build aqui, e isso e proposital.
  #
  # O legacy-state le realDemands.ts direto do disco (bind mount
  # apps/web/src/data -> /web-data) e serve o conteudo em /demands-snapshot.
  # O frontend ja roda useSyncPolling: a cada 30s consulta /sync-status e, se o
  # mtime mudou, busca o snapshot e troca os dados em memoria via
  # updateRuntimeDemands(). O bundle compilado e so o valor inicial — ele e
  # substituido pelo fetch poucos segundos depois do mount.
  #
  # Ou seja: escrever o arquivo acima JA propaga o dado. O `npm ci` + build do
  # Vite que existia aqui regenerava um valor que era descartado em seguida, ao
  # custo de recompilar a aplicacao inteira a cada 5 minutos. Numa VM de 2
  # vCPUs isso empilhou 23 execucoes simultaneas em 2026-09-14 e derrubou o
  # servidor.
  #
  # O garbage collect de assets saiu junto, e precisava sair: ele apagava
  # arquivos de web-dist/assets com mtime acima de 2h, contando com o build pra
  # recria-los.
  #
  # Nota de 2026-09-18: descobrimos depois que web-dist/ nao e servido por
  # ninguem — o compose nao monta esse diretorio no container web, que serve o
  # dist assado na propria imagem. Ou seja, nem o build nem o GC daqui jamais
  # afetaram o que o usuario recebe. Mudanca de codigo do frontend so chega por
  # deploy (rebuild da imagem); ver o bloco `web` em scripts/deploy.sh.
  echo "  [ok] dados atualizados — frontend recebe via /demands-snapshot (sem build)" >> $LOG
else
  echo "  [ok] sem mudancas" >> $LOG
fi

echo "===== $(date -Iseconds) sync concluido =====" >> $LOG
