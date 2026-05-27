# Notificações — guia de configuração

FlowDesk dispara notificações em 4 canais quando eventos relevantes acontecem
(demanda atribuída, status alterado, reply nova, SLA estourado, etc):

| Canal | Onde aparece | Funciona com aba fechada? |
|-------|--------------|---------------------------|
| **Inbox** | Sino na sidebar (`/notificacoes`) | Sim (persiste no servidor) |
| **Push do navegador** | Notification do SO (canto da tela) | Sim, via Service Worker + VAPID |
| **E-mail** | Caixa de entrada do usuário | Sim |
| **Telegram** | Mensagem do bot vinculado | Sim |

Cada usuário configura **individualmente** quais canais quer e quais eventos
disparam em cada canal (Configurações → Notificações).

---

## Arquitetura

```
[ Evento no FlowDesk ]
        │
        ▼
[ notifyXxx(demand, actor) ]  ←── apps/web/src/lib/notificationEvents.ts
        │
        ▼
[ POST /notifications ]  ←── legacy-state container (Express)
        │
        ├─► grava em /data/notifications.json   (inbox)
        ├─► sendEmailFor(...)                   (se EMAIL_ENABLED)
        ├─► sendTelegramFor(...)                (se TELEGRAM_BOT_TOKEN)
        └─► [API nova] dispatchPush             (se VAPID_*)
```

O **legacy-state** é o ponto de fan-out: recebe o POST e dispara nos canais
configurados. Push fica separado porque depende de subscription via Service
Worker registrada na API nova.

---

## 1) Inbox (sempre ligado)

Funciona out-of-the-box. Cada notificação é persistida em
`/opt/flowdesk/app/data/notifications.json`, filtrada por `userEmail` ao
listar. Cap de 500 por usuário.

---

## 2) Push do navegador (Web Push + Service Worker)

### Setup (operador)

1. Gerar chaves VAPID **uma vez** no servidor:
   ```bash
   docker run --rm node:20-alpine npx -y web-push generate-vapid-keys
   ```

2. Adicionar no `.env` do servidor:
   ```env
   VAPID_PUBLIC_KEY=BBxx...
   VAPID_PRIVATE_KEY=Hxx...
   VAPID_SUBJECT=mailto:admin@suaempresa.com
   ```

3. Rodar migration que cria `tb_push_subscription`:
   ```bash
   docker exec -w /app flowdesk-api node_modules/.bin/knex \
     --knexfile knexfile.production.cjs migrate:latest
   ```

4. Recriar API: `docker compose -f docker-compose.server.yml up -d --force-recreate api`

### Setup (usuário)

1. Configurações → aba **Push** → liga o toggle do canal
2. Navegador pede permissão de notificação → permitir
3. Toast confirma: "Push em background ativado"
4. A partir daí, eventos disparam push do SO mesmo com aba fechada

**Limitações conhecidas:**
- Em alguns navegadores móveis (iOS Safari < 16.4) push não funciona
- Se o navegador estiver completamente fechado, push depende do SO
  reativar o service worker (Chrome/Edge/Firefox em desktop sim, Safari
  pode falhar)

---

## 3) E-mail (SMTP)

### Setup (operador)

#### Gmail / Google Workspace

1. Conta que vai enviar precisa ter **2FA ativado**
2. Gerar **App Password** em https://myaccount.google.com/apppasswords
   (App: Mail, Device: nome livre)
3. Adicionar no `.env`:
   ```env
   EMAIL_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=suporte@suaempresa.com
   SMTP_PASS=xxxx xxxx xxxx xxxx     # 16 chars sem espaços
   SMTP_FROM=FlowDesk <suporte@suaempresa.com>
   ```
4. Recriar legacy-state: `docker compose -f docker-compose.server.yml up -d --force-recreate legacy_state`

#### Outros provedores

Mesma estrutura, ajustando `SMTP_HOST/PORT/SECURE`. Provedores comuns:
- **SendGrid**: `smtp.sendgrid.net:587`, user `apikey`, pass é a API key
- **Mailgun**: `smtp.mailgun.org:587`
- **Office 365**: `smtp.office365.com:587`

### Setup (usuário)

Configurações → aba **E-mail** → liga master + eventos desejados → Salvar.

### Verificar envio

```bash
# Logs do legacy-state
docker logs flowdesk-legacy-state --tail 20 | grep email

# Teste direto via API
docker exec flowdesk-legacy-state wget -qO- \
  --post-data='{"userEmail":"voce@empresa.com","event":"demand_completed","source":"slack","demandId":"test","title":"Teste","message":"oi"}' \
  --header='Content-Type: application/json' http://localhost:8090/notifications
```

---

## 4) Telegram

### Setup (operador, uma vez)

1. Criar bot via [@BotFather](https://t.me/BotFather):
   - `/newbot` → escolher nome + username (termina em `bot`)
   - Anotar o **token** (`123456:AAA...`)
2. Configurar comandos (`/setcommands` no BotFather):
   ```
   start - Vincular conta FlowDesk
   help - Ajuda
   status - Ver conta vinculada
   desconectar - Desvincular conta
   ```
3. Gerar secret e adicionar no `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456:AAA...
   TELEGRAM_BOT_USERNAME=seu_bot_username
   TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 16)
   ```
4. Apontar o webhook do bot pro servidor:
   ```bash
   TOKEN=<TELEGRAM_BOT_TOKEN>
   SECRET=<TELEGRAM_WEBHOOK_SECRET>
   curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" \
     -d "url=https://<seu-dominio>/telegram-events/$SECRET&drop_pending_updates=true"
   ```
5. Recriar legacy-state: `docker compose -f docker-compose.server.yml up -d --force-recreate legacy_state`

### Setup (usuário)

1. Configurações → card **Telegram** → **Conectar Telegram**
2. UI mostra um código de 8 caracteres (ex: `A1B2C3D4`) válido por 10 min
3. Abre conversa com o `@<seu_bot>` no Telegram
4. Manda `/start A1B2C3D4`
5. Bot responde com confirmação ✓
6. UI atualiza pra "Conectado"

A partir daí, a aba Telegram em Configurações → Notificações controla
quais eventos disparam pra esse usuário.

### Diagnóstico

```bash
# Status do webhook
curl -s "https://api.telegram.org/bot$TOKEN/getWebhookInfo" | python3 -m json.tool

# Quem está vinculado
cat /opt/flowdesk/app/data/telegram-links.json

# Logs de envio
docker logs flowdesk-legacy-state --tail 20 | grep telegram
```

---

## Modelo de preferências por usuário

Persistido em `/opt/flowdesk/app/data/notificationPreferences.json`:

```json
{
  "hugo@empresa.com": {
    "userEmail": "hugo@empresa.com",
    "events": {
      "demand_assigned": true,
      "demand_completed": true,
      ...
    },
    "channels": {
      "inbox": true,
      "browserPush": true,
      "email": true,
      "telegram": true
    },
    "eventsByChannel": {
      "email": { "demand_replied": false }
    },
    "slaReminders": { "p1Hours": 1, "p2Hours": 2, "p3Hours": 4 },
    "dailyReminder": true
  }
}
```

- **`events`**: defaults globais por evento (vale pra todos os canais)
- **`channels`**: master switch por canal
- **`eventsByChannel`**: override por canal/evento. Se definido, vence sobre o
  global. Útil pra "quero email só pra demandas concluídas, mas inbox de
  tudo"

---

## Eventos suportados

| Evento | Quando dispara | Default |
|--------|----------------|---------|
| `demand_assigned` | Demanda atribuída a um responsável | on |
| `demand_replied` | Nova reply na thread Slack | on |
| `demand_started` | Status → `em_andamento` | on |
| `demand_completed` | Status → `concluida` | on |
| `demand_reopened` | Status `concluida` → outro | on |
| `demand_overdue` | SLA estourado | on |
| `demand_due_soon` | SLA próximo de vencer (config por prioridade) | on |
| `demand_approved` | Demanda SQL/Deploy aprovada | on |
| `demand_rejected` | Demanda SQL/Deploy reprovada | on |
| `demand_created` | Nova demanda criada (ruidoso, off por default) | off |

---

## Quem recebe?

Implementado em `apps/web/src/lib/notificationEvents.ts:recipientsForDemand`:

- **Requester** (solicitante) e **assignee** (responsável) são candidatos
- **Actor** (quem fez a ação) é excluído pra não se auto-notificar
- **Exceção**: se assignee == actor (auto-atribuição), actor recebe — assim
  fica claro que a ação foi efetivada
- Email é resolvido buscando no `fd_users_v2` do localStorage por `name` ou `login`.
  Se o nome não bate (ex: requester externo do Slack), aquele candidato é ignorado

---

## Rotação de credenciais

Todas as credenciais ficam no `.env` do servidor:

- `TELEGRAM_BOT_TOKEN` — revogue em `@BotFather` → `/revoke` e gere novo
- `SMTP_PASS` — revogue em https://myaccount.google.com/apppasswords (Gmail)
  ou no painel do provedor
- `VAPID_PRIVATE_KEY` — gere novo par e re-distribua. **Todos os usuários
  precisarão re-subscrever** (apagar `tb_push_subscription` e religar nas
  configurações)
- `TELEGRAM_WEBHOOK_SECRET` — gere novo + re-aponte o webhook
