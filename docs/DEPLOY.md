# Deploy do FlowDesk em produção (on-prem)

Guia passo-a-passo para subir o FlowDesk no servidor da Just.

## Requisitos

- **Node.js** 20 LTS ou superior
- **npm** 10+
- **systemd** (qualquer Linux moderno)
- **nginx** 1.18+ para HTTPS e reverse proxy
- **Certificado TLS** válido para o domínio interno
- Usuário Linux dedicado (`flowdesk`) sem privilégio root

## 1. Preparação do servidor

```bash
# Como root
sudo useradd -m -s /bin/bash flowdesk
sudo mkdir -p /opt/flowdesk /var/log/flowdesk /var/backups/flowdesk
sudo chown -R flowdesk:flowdesk /opt/flowdesk /var/log/flowdesk /var/backups/flowdesk
```

## 2. Clone e instalação

```bash
sudo -iu flowdesk
cd /opt/flowdesk
git clone https://github.com/HugoJunioor/FlowDesk.git app
cd app
npm ci
npm run build
```

## 3. Configuração (.env)

Crie `/opt/flowdesk/app/.env` com permissão 600:

```bash
# Slack (obrigatórios para sync)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Bootstrap (escolha uma das opções)
# Opção A: senha definida — pode ser fácil de comunicar internamente
VITE_BOOTSTRAP_PASSWORD=<senha-forte-de-no-minimo-10-chars>
# Opção B: deixe em branco — senha aleatória vai aparecer no log do serviço

# Segurança
FLOWDESK_ALLOWED_ORIGINS=https://flowdesk.just.com.br
FLOWDESK_LOG_LEVEL=info

# Resend (opcional, para email notifications)
# RESEND_API_KEY=re_...
```

```bash
chmod 600 .env
```

## 4. Serviço systemd

Crie `/etc/systemd/system/flowdesk.service`:

```ini
[Unit]
Description=FlowDesk - demand management
After=network.target

[Service]
Type=simple
User=flowdesk
Group=flowdesk
WorkingDirectory=/opt/flowdesk/app
Environment=NODE_ENV=production
EnvironmentFile=/opt/flowdesk/app/.env
ExecStart=/usr/bin/npm run preview -- --host 127.0.0.1 --port 4173
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/flowdesk/app.log
StandardError=append:/var/log/flowdesk/app.error.log

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/flowdesk/app/data /var/log/flowdesk
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable flowdesk
sudo systemctl start flowdesk
sudo systemctl status flowdesk
```

## 5. nginx (HTTPS + reverse proxy)

`/etc/nginx/sites-available/flowdesk`:

```nginx
server {
    listen 443 ssl http2;
    server_name flowdesk.just.com.br;

    ssl_certificate     /etc/ssl/flowdesk/fullchain.pem;
    ssl_certificate_key /etc/ssl/flowdesk/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Segurança extra
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://127.0.0.1:4173/health;
        access_log off;
    }
}

server {
    listen 80;
    server_name flowdesk.just.com.br;
    return 301 https://$server_name$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/flowdesk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Primeiro acesso

1. Abra `https://flowdesk.just.com.br`
2. Login: `master`
3. Senha:
   - Se você definiu `VITE_BOOTSTRAP_PASSWORD`: use ela
   - Senão: rode `journalctl -u flowdesk | grep "Senha:"` e pegue a aleatória
4. Sistema vai pedir para trocar a senha imediatamente

## 7. Restauração de dados (após aprovação do supervisor)

A partir da Fase 9 (migração para Postgres), o fluxo é:

### 7.1 Pre-condição: Postgres + migrations

```bash
# No servidor (ou docker compose em dev)
sudo -iu flowdesk
cd /opt/flowdesk/app/apps/api

# Aplica schema (idempotente — só roda o que falta)
npm run migrate

# Cria grupos padrão + master user
npm run seed
# Anote a senha master do log!
```

### 7.2 Importar dados legados (JSON → Postgres)

Se você tem dados em `apps/web/data/*.json` (gerados pelo Vite plugin
antigo), pode importá-los pro Postgres:

```bash
sudo -iu flowdesk
cd /opt/flowdesk/app/apps/api

# Dry-run primeiro: conta quantos registros seriam importados
npm run import:json -- --dry-run

# Importa de verdade (idempotente: pula registros que já existem por id)
npm run import:json

# Ou só uma fonte específica:
npm run import:json -- --only=notas
npm run import:json -- --only=notificacoes
npm run import:json -- --only=preferencias
npm run import:json -- --only=infra
```

O script lê:
- `apps/web/data/notes.json` → `tb_nota` + `tb_item_nota`
- `apps/web/data/notifications.json` → `tb_notificacao`
- `apps/web/data/notificationPreferences.json` → `tb_preferencia_notificacao`
- `apps/web/data/infraDemands.json` → `tb_demanda` (origem=internal)

Demandas Slack (`apps/web/src/data/realDemands.ts`) ainda são carregadas
diretamente pelo frontend via `import.meta.glob` enquanto a Fase 8+
estiver em andamento. Quando o frontend migrar 100% pra nova API, o
sync direto pro Postgres vai substituir esse arquivo.

### 7.3 Validar

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tb_nota;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tb_notificacao;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tb_demanda;"
```

## 8. Verificação pós-deploy

```bash
# Serviço ativo
sudo systemctl is-active flowdesk

# Health check responde
curl -s https://flowdesk.just.com.br/health | jq

# Logs sem erros
sudo tail -f /var/log/flowdesk/app.error.log

# nginx serve HTTPS corretamente
curl -I https://flowdesk.just.com.br
```

Saída esperada do `/health`:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "startedAt": "2026-05-12T10:00:00.000Z",
  "uptimeSeconds": 3600
}
```

## Rollback

Se algo der errado após um deploy:

```bash
cd /opt/flowdesk/app
git log --oneline -5            # ache o commit anterior estável
git checkout <hash-anterior>
npm ci
npm run build
sudo systemctl restart flowdesk
```

Veja também: [RUNBOOK.md](./RUNBOOK.md) para operação do dia-a-dia.
