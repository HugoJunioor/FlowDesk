# Slack Events API — Webhook

Recebe eventos do Slack em tempo real via **Events API**, eliminando o delay de ~5min do polling.

---

## Como funciona

```
Slack → POST /api/v1/slack/events → verifySlackSignature → slackController → slackService
```

- Assinatura HMAC SHA256 validada no middleware (`X-Slack-Signature`).
- `url_verification`: responde `{ challenge }` imediatamente.
- `event_callback`: processa e responde `200` em até 3s (Slack retenta se demorar mais).
- Deduplicação via LRU em memória (10k event IDs).
- Polling (`syncSlack.cjs`) continua rodando em paralelo — idempotência cobre.

---

## Configuração em api.slack.com/apps

### 1. Event Subscriptions

1. Abra seu app em [api.slack.com/apps](https://api.slack.com/apps).
2. Vá em **Event Subscriptions** → habilite **Enable Events**.
3. **Request URL**: `https://seu-dominio.com/api/v1/slack/events`
4. O Slack envia um `url_verification`. A API responde automaticamente com o `challenge`.
5. Status deve ficar **Verified**.

### 2. Escopos de evento para subscrever

Em **Subscribe to bot events**:

| Evento              | Por quê                                               |
|---------------------|-------------------------------------------------------|
| `message.channels`  | Mensagens em canais públicos (`#cliente-*`)           |
| `message.groups`    | Mensagens em canais privados (`#cliente-*` privados)  |
| `reaction_added`    | Marca demanda como concluída (`:large_green_circle:`) |
| `reaction_removed`  | Reabre demanda quando reaction é removida             |
| `channel_created`   | Log quando novo canal cliente é criado (opcional)     |

### 3. Escopos OAuth necessários

Em **OAuth & Permissions → Scopes → Bot Token Scopes**:

- `channels:history`
- `groups:history`
- `reactions:read`
- `channels:read`

---

## Variáveis de ambiente

```dotenv
# Habilita a rota /api/v1/slack/events
SLACK_WEBHOOK_ENABLED=true

# Secret em Settings > Basic Information > App Credentials > Signing Secret
SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Em produção, a rota só sobe se `SLACK_WEBHOOK_ENABLED=true`.
> Se `SLACK_SIGNING_SECRET` estiver ausente em produção, a rota bloqueia todos os requests com 403.

---

## Testando localmente com ngrok

```bash
# 1. Instale o ngrok (https://ngrok.com)
ngrok http 4000

# 2. Copie a URL gerada, ex: https://abc123.ngrok-free.app

# 3. Configure no Slack:
#    Event Subscriptions > Request URL:
#    https://abc123.ngrok-free.app/api/v1/slack/events

# 4. No .env local:
SLACK_WEBHOOK_ENABLED=true
SLACK_SIGNING_SECRET=<seu signing secret>

# 5. Envie um evento de teste pelo Slack Developer Tools ou pelo próprio app.
```

### Simulando manualmente com curl

```bash
BODY='{"type":"url_verification","challenge":"test123"}'
TIMESTAMP=$(date +%s)
SECRET="seu_signing_secret"
SIG_BASE="v0:${TIMESTAMP}:${BODY}"
SIG="v0=$(echo -n "$SIG_BASE" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -X POST http://localhost:4000/api/v1/slack/events \
  -H "Content-Type: application/json" \
  -H "X-Slack-Request-Timestamp: $TIMESTAMP" \
  -H "X-Slack-Signature: $SIG" \
  -d "$BODY"
# Esperado: {"challenge":"test123"}
```

---

## Migration path — polling em paralelo

O polling (`apps/web/scripts/syncSlack.cjs`) e o webhook rodam simultaneamente sem conflito:

- Mesmo evento chegando pelos dois caminhos → `ON CONFLICT DO NOTHING` no upsert de demanda.
- `reaction_added`/`removed` são idempotentes (UPDATE não falha se status já estava correto).

**Plano sugerido:**

1. Habilitar webhook em staging com `SLACK_WEBHOOK_ENABLED=true`.
2. Monitorar logs por 48h — confirmar que demandas chegam via webhook sem duplicatas.
3. Reduzir intervalo do polling para 30min (para manter como fallback).
4. Após 1 semana estável: desabilitar polling (`SYNC_SLACK_ENABLED=false` no cron, se existir).

---

## Eventos ignorados

Qualquer `event_type` não mapeado (`message` fora de canal cliente, channel_join, etc.) recebe `200 OK` com log `debug`. O Slack não retenta quando recebe 200.
