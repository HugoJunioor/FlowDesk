# Deploy do FlowDesk em producao (on-prem)

Guia completo para a equipe de TI da Just subir o FlowDesk num servidor Linux
sem precisar perguntar nada para o time de desenvolvimento.

---

## 1. Visao geral

```
Internet
   |
   v
[nginx host — 80/443]          <- reverse proxy publico, TLS, headers seguranca
   |               \
   v                v
[web :8080]      [api :4000]   <- containers Docker (127.0.0.1 apenas)
                    |
                    v
              [postgres :5432] <- rede Docker interna, nunca exposta ao host
```

Stack de producao:
- **nginx** no host: proxy reverso, HTTPS/TLS, serve `/` (web estatico) e `/api/v1` (API)
- **web**: container nginx:alpine servindo o build Vite (`apps/web/dist`)
- **api**: container Node.js 20 com Express (porta 4000 interna)
- **postgres 16**: container com volume nomeado `flowdesk_db`

Tudo orquestrado via `docker compose -f docker-compose.prod.yml`.

---

## 2. Pre-requisitos do servidor

| Item | Minimo |
|------|--------|
| OS | Ubuntu 22.04 LTS (ou Debian 12 compativel) |
| Docker Engine | 24+ |
| docker compose | v2.20+ (plugin, nao o binario separado) |
| RAM | 4 GB |
| Disco | 20 GB (dados do Postgres crescem com uso) |
| Portas publicas | 80, 443 |
| Porta interna | 5432 FECHADA para o mundo |
| Dominio | Ex: `flowdesk.empresa.com` com DNS A apontando para o IP do servidor |

Verificar versoes:

```bash
docker --version
docker compose version
```

---

## 3. Setup inicial

### 3.1 Usuario e diretorios

```bash
# Como root
sudo useradd -m -s /bin/bash flowdesk
sudo usermod -aG docker flowdesk          # permite rodar docker sem sudo
sudo mkdir -p /opt/flowdesk /var/log/flowdesk /var/backups/flowdesk
sudo chown -R flowdesk:flowdesk /opt/flowdesk /var/log/flowdesk /var/backups/flowdesk
```

### 3.2 Clone do repositorio

```bash
sudo -iu flowdesk
cd /opt/flowdesk
git clone https://github.com/HugoJunioor/FlowDesk.git app
cd app
```

### 3.3 Variaveis de ambiente

```bash
# API (obrigatorio)
cp apps/api/.env.example apps/api/.env
chmod 600 apps/api/.env
```

Edite `apps/api/.env` e ajuste os valores obrigatorios:

```bash
# Database — use senha forte, alfanumerica, sem caracteres especiais que quebrem URL
# Mesma senha usada em POSTGRES_PASSWORD abaixo
DATABASE_URL=postgresql://flowdesk:<SENHA-FORTE>@postgres:5432/flowdesk

NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# JWT — gere com: openssl rand -base64 48
JWT_SECRET=<64-chars-aleatorios>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
COOKIE_SECURE=true
COOKIE_DOMAIN=flowdesk.empresa.com

# CORS — dominio publico da aplicacao
ALLOWED_ORIGINS=https://flowdesk.empresa.com

# Slack (obrigatorio para sync de demandas)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# SLA cron — recomendado em prod
SLA_CRON_ENABLED=true
SLA_CRON_INTERVAL_SECONDS=300
```

Crie `.env` na raiz (usado pelo docker-compose.prod.yml para a senha do Postgres):

```bash
cat > /opt/flowdesk/app/.env <<'EOF'
POSTGRES_PASSWORD=<SENHA-FORTE>
EOF
chmod 600 /opt/flowdesk/app/.env
```

> **Seguranca:** `JWT_SECRET` e `POSTGRES_PASSWORD` nunca devem ser
> commitados. Esses arquivos estao no `.gitignore`.

### 3.4 Build do frontend

O build precisa ser feito antes de subir os containers — o dist e copiado
para o volume nomeado `flowdesk_web_dist`.

```bash
# Ainda como usuario flowdesk, dentro de /opt/flowdesk/app
npm ci
npm run build -w @flowdesk/web
# Resultado em apps/web/dist/

# Criar volume e popular com o dist buildado
docker volume create flowdesk_web_dist
docker run --rm \
  -v "$(pwd)/apps/web/dist:/src:ro" \
  -v flowdesk_web_dist:/dst \
  alpine sh -c "cp -r /src/. /dst/"
```

### 3.5 Pre-flight check

Antes de subir os containers, rode o script de validacao para garantir que todas
as variaveis obrigatorias estao definidas e que os servicos externos respondem:

```bash
# Na raiz do repositorio
node scripts/preflight-check.mjs
# ou via npm
npm run preflight
```

O script verifica:
- Presenca e validade de todas as variaveis obrigatorias (inclusive comprimento minimo do `JWT_SECRET`)
- Conectividade com o Postgres (`SELECT 1`)
- Token do Slack (`auth.test`)
- Bot do Telegram (se `TELEGRAM_ENABLED=true`)
- Conexao SMTP (se `SMTP_HOST` definido)

Saida esperada se tudo estiver ok:

```
=== FlowDesk Pre-flight Check ===

Variaveis obrigatorias
  v NODE_ENV
  v DATABASE_URL
  ...

PostgreSQL
  v Conexao estabelecida e SELECT 1 respondeu

Slack
  v Token valido — team: Just, bot: flowdeskbot

Pre-flight OK. Pode subir os containers.
```

Se qualquer item falhar, o script termina com exit code 1 e lista o que precisa ser corrigido.
Consulte `docs/PROD_ENV_CHECKLIST.md` para detalhes de cada variavel.

### 3.6 Subir os containers

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Saida esperada: todos os servicos `healthy` ou `running`.

### 3.7 Migrate inicial

```bash
docker compose -f docker-compose.prod.yml exec api \
  npm run migrate -w @flowdesk/api
```

Para criar o usuario master inicial:

```bash
docker compose -f docker-compose.prod.yml exec api \
  npm run seed -w @flowdesk/api
# Anote a senha master que aparece no log!
```

---

## 4. nginx reverse proxy (host)

### 4.1 Instalar nginx + certbot

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
```

### 4.2 Snippet de configuracao

Crie `/etc/nginx/sites-available/flowdesk`:

```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name flowdesk.empresa.com;
    return 301 https://$host$request_uri;
}

# HTTPS principal
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name flowdesk.empresa.com;

    ssl_certificate     /etc/letsencrypt/live/flowdesk.empresa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowdesk.empresa.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # Headers de seguranca
    add_header Strict-Transport-Security  "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "DENY" always;
    add_header X-Content-Type-Options     "nosniff" always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy         "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://slack.com; frame-ancestors 'none';" always;

    client_max_body_size 10M;

    # Frontend estatico (container web)
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # API backend
    location /api/v1/ {
        proxy_pass         http://127.0.0.1:4000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Health check — sem log de acesso (evita ruido)
    location /health {
        proxy_pass         http://127.0.0.1:4000/health;
        access_log         off;
    }
}
```

Substituir `flowdesk.empresa.com` pelo dominio real antes de continuar.

### 4.3 Ativar e obter certificado

```bash
sudo ln -s /etc/nginx/sites-available/flowdesk /etc/nginx/sites-enabled/
sudo nginx -t

# Obter certificado Let's Encrypt (responde as perguntas interativas)
sudo certbot --nginx -d flowdesk.empresa.com

# Testar renovacao automatica
sudo certbot renew --dry-run

sudo systemctl reload nginx
```

---

## 5. Docker Compose producao

O arquivo `docker-compose.prod.yml` na raiz do repositorio define tres servicos:

| Servico | Imagem | Porta interna | Exposta ao host |
|---------|--------|--------------|-----------------|
| `postgres` | postgres:16-alpine | 5432 | Nao |
| `api` | build local `apps/api/` | 4000 | 127.0.0.1:4000 |
| `web` | nginx:1.27-alpine | 80 | 127.0.0.1:8080 |

Pontos importantes:
- **Named volumes** para tudo — sem bind-mounts em prod (`flowdesk_db`, `flowdesk_web_dist`).
- API so aceita conexoes de `127.0.0.1` — nginx do host e o unico ponto de entrada publico.
- Postgres **nao tem porta exposta** ao host; acesso via `docker compose exec postgres`.
- Logs com rotacao automatica via `json-file` driver (50 MB / 5 arquivos para a API).

---

## 6. Backup automatico (cron)

### 6.1 Script de backup

Crie `/opt/flowdesk/scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/var/backups/flowdesk
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/flowdesk_$TIMESTAMP.sql.gz"

# Dump via container postgres
docker compose -f /opt/flowdesk/app/docker-compose.prod.yml \
  exec -T postgres \
  pg_dump -U flowdesk flowdesk | gzip > "$FILE"

# Manter apenas os ultimos 30 backups
find "$BACKUP_DIR" -name "flowdesk_*.sql.gz" -mtime +30 -delete

echo "Backup OK: $FILE"
```

```bash
chmod +x /opt/flowdesk/scripts/backup.sh
```

### 6.2 Cron

Crie `/etc/cron.d/flowdesk-backup`:

```cron
0 2 * * * flowdesk /opt/flowdesk/scripts/backup.sh >> /var/log/flowdesk/backup.log 2>&1
```

### 6.3 Rotacao de logs com logrotate

Crie `/etc/logrotate.d/flowdesk`:

```
/var/log/flowdesk/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 flowdesk flowdesk
}
```

---

## 7. Monitoramento

### 7.1 Logs dos containers

```bash
# Todos os servicos em tempo real
docker compose -f docker-compose.prod.yml logs -f

# Apenas API
docker compose -f docker-compose.prod.yml logs -f api

# Ultimas 100 linhas
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

### 7.2 Health endpoint

```bash
# Basico
curl -s https://flowdesk.empresa.com/health | jq

# Detalhado (DB, disco, memoria) — util para Prometheus / Zabbix
curl -s https://flowdesk.empresa.com/api/v1/health/detailed | jq
```

Exemplo de resposta `/api/v1/health/detailed`:

```json
{
  "status": "ok",
  "version": "1.2.0",
  "checks": {
    "database": "ok",
    "disk": { "status": "ok", "freeGb": 14.2 },
    "memory": { "status": "ok", "usedMb": 312 }
  }
}
```

### 7.3 Alerta basico por email (cron)

Crie `/opt/flowdesk/scripts/health-check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

URL="https://flowdesk.empresa.com/health"
ALERT_EMAIL="ti@empresa.com"
MAX_FAILS=3
FAIL_COUNT_FILE=/tmp/flowdesk-health-fails
LOCK_FILE=/tmp/flowdesk-health-alert.lock

FAILS=$(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0)

if curl -sf --max-time 5 "$URL" > /dev/null; then
    echo 0 > "$FAIL_COUNT_FILE"
    rm -f "$LOCK_FILE"
else
    FAILS=$((FAILS + 1))
    echo "$FAILS" > "$FAIL_COUNT_FILE"

    if [ "$FAILS" -ge "$MAX_FAILS" ] && [ ! -f "$LOCK_FILE" ]; then
        touch "$LOCK_FILE"
        echo "FlowDesk fora do ar por 5+ minutos. Verificar servidor." \
          | mail -s "[ALERTA] FlowDesk down" "$ALERT_EMAIL"
    fi
fi
```

```bash
chmod +x /opt/flowdesk/scripts/health-check.sh
```

Adicione ao `/etc/cron.d/flowdesk-backup`:

```cron
*/5 * * * * flowdesk /opt/flowdesk/scripts/health-check.sh >> /var/log/flowdesk/health.log 2>&1
```

Para o `mail` funcionar: `sudo apt install -y mailutils` e configure o MTA do servidor.

---

## 8. Atualizacao

```bash
cd /opt/flowdesk/app

# 1. Pegar nova versao
git pull

# 2. Rebuildar imagem da API
docker compose -f docker-compose.prod.yml build api

# 3. Rebuildar frontend e atualizar volume
npm ci
npm run build -w @flowdesk/web
docker run --rm \
  -v "$(pwd)/apps/web/dist:/src:ro" \
  -v flowdesk_web_dist:/dst \
  alpine sh -c "rm -rf /dst/* && cp -r /src/. /dst/"

# 4. Rodar migrations (idempotente — seguro rodar sempre)
docker compose -f docker-compose.prod.yml run --rm api \
  npm run migrate -w @flowdesk/api

# 5. Restartar servicos (postgres nao reinicia se a imagem nao mudou)
docker compose -f docker-compose.prod.yml up -d

# 6. Verificar saude
curl -s https://flowdesk.empresa.com/health | jq
```

---

## 9. Rollback

### 9.1 Rollback de codigo (sem mudanca de schema)

```bash
cd /opt/flowdesk/app

# Listar tags de release
git tag --sort=-version:refname | head -10

# Voltar para tag anterior
git checkout <tag-anterior>

# Rebuild e restart (sem migrate)
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api

npm run build -w @flowdesk/web
docker run --rm \
  -v "$(pwd)/apps/web/dist:/src:ro" \
  -v flowdesk_web_dist:/dst \
  alpine sh -c "rm -rf /dst/* && cp -r /src/. /dst/"
```

### 9.2 Rollback de banco (com mudanca de schema)

```bash
# Fazer backup ANTES do rollback (nao sobreescrever o backup diario)
/opt/flowdesk/scripts/backup.sh

# Rollback de migration
docker compose -f docker-compose.prod.yml exec api \
  npm run migrate:rollback -w @flowdesk/api

# Se necessario restaurar dump especifico
BACKUP_FILE=/var/backups/flowdesk/flowdesk_20260515_020000.sql.gz

docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U flowdesk -d postgres -c "DROP DATABASE IF EXISTS flowdesk; CREATE DATABASE flowdesk;"

gunzip -c "$BACKUP_FILE" | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U flowdesk flowdesk
```

> Restaurar dump apaga todos os dados posteriores ao backup. Confirme com
> o responsavel antes de executar.

---

## 10. Troubleshooting producao

### Container nao sobe

```bash
docker compose -f docker-compose.prod.yml logs <service>
docker compose -f docker-compose.prod.yml ps
```

Causas comuns:
- `postgres` demora no healthcheck na primeira inicializacao — aguardar 30s e tentar novamente.
- `api` falha se `DATABASE_URL` incorreta ou `POSTGRES_PASSWORD` diverge entre `.env` e `apps/api/.env`.

### 502 Bad Gateway no nginx

A API caiu ou nao respondeu no timeout. Verificar:

```bash
docker compose -f docker-compose.prod.yml ps api
docker compose -f docker-compose.prod.yml logs --tail=50 api
curl -s http://127.0.0.1:4000/health
```

Se o container estiver `unhealthy`: `docker compose -f docker-compose.prod.yml restart api`.

### Login falha / token invalido

Causa mais comum: `JWT_SECRET` foi alterado ou o `.env` nao foi carregado.

```bash
docker compose -f docker-compose.prod.yml exec api printenv JWT_SECRET
# Deve retornar o valor configurado em apps/api/.env
```

Se mudou o secret, todos os usuarios precisam fazer login novamente — tokens antigos sao invalidos por design.

### Sync Slack nao roda

1. Verificar token: `docker compose -f docker-compose.prod.yml exec api printenv SLACK_BOT_TOKEN`
2. Conferir erros recentes na auditoria: `GET /api/v1/auditoria?limit=20`
3. Tokens Slack expiram raramente, mas bots podem perder permissoes. Verificar no painel Slack em `api.slack.com/apps`.

### Disco cheio

```bash
df -h /
du -sh /var/backups/flowdesk/*
docker system df
docker system prune --volumes  # CUIDADO: remove volumes nao usados
```

Verificar se o logrotate esta rodando: `sudo logrotate -f /etc/logrotate.d/flowdesk`.

### Postgres nao conecta

```bash
# Acessar psql diretamente
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U flowdesk -d flowdesk -c "\dt"
```

---

## 11. Verificacao pos-deploy

```bash
# Todos os containers healthy
docker compose -f docker-compose.prod.yml ps

# Health basico
curl -s https://flowdesk.empresa.com/health | jq

# Health detalhado (DB, disco, memoria)
curl -s https://flowdesk.empresa.com/api/v1/health/detailed | jq

# HTTPS com headers corretos
curl -I https://flowdesk.empresa.com

# Logs sem erros criticos
docker compose -f docker-compose.prod.yml logs --tail=50 api | grep -i error || echo "Sem erros"
```

---

Veja tambem: [RUNBOOK.md](./RUNBOOK.md) para operacao do dia-a-dia.
