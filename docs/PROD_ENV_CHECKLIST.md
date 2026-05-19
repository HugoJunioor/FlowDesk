# FlowDesk — Checklist de Variáveis de Ambiente (Produção)

Referência completa de todas as variáveis de ambiente. Extraída do schema Zod em
`apps/api/src/config/env.ts` e dos arquivos `.env.example`.

---

## Mínimo viável pra subir

Essas variáveis **precisam estar definidas** antes de `docker compose up`. Sem elas, a API
não sobe ou gera falha silenciosa em runtime.

| Var | Onde definir |
|-----|-------------|
| `DATABASE_URL` | `apps/api/.env` |
| `JWT_SECRET` | `apps/api/.env` |
| `POSTGRES_PASSWORD` | `.env` (raiz) |
| `ALLOWED_ORIGINS` | `apps/api/.env` |
| `NODE_ENV=production` | `apps/api/.env` |
| `COOKIE_SECURE=true` | `apps/api/.env` |
| `COOKIE_DOMAIN` | `apps/api/.env` |
| `SLACK_BOT_TOKEN` | `apps/api/.env` |
| `SLACK_SIGNING_SECRET` | `apps/api/.env` |
| `TEAM_EMAIL_DOMAINS` | `.env` (raiz) |

---

## Geradores rápidos

```bash
# JWT_SECRET (minimo 32 chars)
openssl rand -base64 48

# POSTGRES_PASSWORD (alfanumerico, sem chars especiais que quebrem URL)
openssl rand -base64 24 | tr -d '/+=' | head -c 32

# SLACK_SIGNING_SECRET — obtido em api.slack.com/apps > Basic Information
# (nao gerado localmente)
```

---

## Variáveis por categoria

### API / Servidor

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `NODE_ENV` | Sim (prod) | `development` | Modo de execucao. Em prod deve ser `production`. | Definir manualmente |
| `PORT` | Nao | `4000` | Porta interna da API Express. | — |
| `LOG_LEVEL` | Nao | `info` | Nivel de log pino. Opcoes: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. | — |
| `OPENAPI_ENABLED` | Nao | `true` | Habilita Swagger UI em `/api/v1/docs`. Recomendado `false` em prod. | — |
| `BUILD_SHA` | Nao | — | Hash do commit injetado pelo CI. Aparece em `GET /api/v1/version`. | CI injeta automaticamente |
| `BUILD_DATE` | Nao | — | Data de build ISO 8601 injetada pelo CI. Aparece em `GET /api/v1/version`. | CI injeta automaticamente |

### Database

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `DATABASE_URL` | **Sim** | — | URL completa de conexao Postgres. Formato: `postgresql://user:pass@host:5432/db`. A senha deve coincidir com `POSTGRES_PASSWORD`. | Montar com as credenciais do container |
| `DATABASE_POOL_MIN` | Nao | `2` | Minimo de conexoes no pool pg. | — |
| `DATABASE_POOL_MAX` | Nao | `10` | Maximo de conexoes no pool pg. | — |
| `POSTGRES_PASSWORD` | **Sim** | — | Senha do Postgres usada pelo docker-compose.prod.yml para criar o container. Deve coincidir com a senha em `DATABASE_URL`. | `openssl rand -base64 24 \| tr -d '/+=' \| head -c 32` |

### Auth / JWT

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `JWT_SECRET` | **Sim** | — | Chave de assinatura dos tokens. Minimo 32 chars. Qualquer alteracao invalida todos os tokens ativos. | `openssl rand -base64 48` |
| `JWT_ACCESS_TTL` | Nao | `15m` | TTL do access token. Formato: `15m`, `1h`, etc. | — |
| `JWT_REFRESH_TTL` | Nao | `7d` | TTL do refresh token (cookie HttpOnly). | — |
| `COOKIE_SECURE` | Nao | `false` | Exigir HTTPS para cookies. Deve ser `true` em prod. | — |
| `COOKIE_DOMAIN` | Nao | — | Dominio do cookie de refresh (ex: `flowdesk.empresa.com`). | Dominio publico do servidor |

### CORS

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `ALLOWED_ORIGINS` | **Sim** | `http://localhost:5173,http://localhost:4173` | Lista CSV de origens permitidas pelo CORS. Em prod: apenas o dominio publico HTTPS. | URL publica do frontend |

### Rate Limiting

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `RATE_LIMIT_AUTH` | Nao | `10` | Max requests/min em rotas de autenticacao. | — |
| `RATE_LIMIT_WRITE` | Nao | `60` | Max requests/min em rotas de escrita (POST/PATCH/DELETE). | — |
| `RATE_LIMIT_READ` | Nao | `300` | Max requests/min em rotas de leitura (GET geral). | — |

### Slack

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `SLACK_BOT_TOKEN` | **Sim** | — | Token do bot Slack (prefixo `xoxb-`). Necessario para sync de demandas. | `api.slack.com/apps` > seu app > OAuth & Permissions > Bot User OAuth Token |
| `SLACK_SIGNING_SECRET` | **Sim** | — | Secret para validar assinatura dos webhooks do Slack. | `api.slack.com/apps` > Basic Information > Signing Secret |
| `SLACK_CLIENT_ID` | Nao | — | Client ID para OAuth de usuario (postar como usuario). | `api.slack.com/apps` > Basic Information > App Credentials |
| `SLACK_CLIENT_SECRET` | Nao | — | Client Secret para OAuth de usuario. | `api.slack.com/apps` > Basic Information > App Credentials |
| `SLACK_REDIRECT_URI` | Nao | — | URL de callback do OAuth Slack. Precisa estar registrada no app Slack. | URL publica do servidor + `/auth/slack/callback` |
| `SLACK_WORKSPACE` | Nao | — | Nome do workspace Slack (display apenas). | Nome do workspace |
| `TEAM_EMAIL_DOMAINS` | **Sim** | — | JSON array de dominios de email corporativo. Ex: `["wearejust.it"]`. Determina quem e equipe interna. | Definir com dominio da empresa |
| `TEAM_MEMBERS` | Nao | `[]` | JSON array de nomes de membros sem email exposto no Slack (fallback). | — |

### Telegram

> Integracao opcional. Se `TELEGRAM_ENABLED` nao estiver como `true`, nenhuma das vars abaixo e necessaria.

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `TELEGRAM_ENABLED` | Nao | — | Habilitar integracao Telegram. Definir como `true` para ativar. | — |
| `TELEGRAM_BOT_TOKEN` | Condicional | — | Token do bot Telegram. Obrigatorio se `TELEGRAM_ENABLED=true`. | Conversar com @BotFather no Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Condicional | — | Secret para validar requests do webhook Telegram. | `openssl rand -hex 16` |

### SMTP

> Integracao opcional. Se `SMTP_HOST` nao estiver definido, envio de email fica desabilitado.

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `SMTP_HOST` | Nao | — | Host do servidor SMTP. Ex: `smtp.gmail.com`. | Provedor de email |
| `SMTP_PORT` | Nao | `587` | Porta SMTP. `587` para STARTTLS, `465` para SSL. | Provedor de email |
| `SMTP_SECURE` | Nao | `false` | Usar SSL/TLS direto (porta 465). `false` = STARTTLS. | — |
| `SMTP_USER` | Nao | — | Usuario de autenticacao SMTP. | Provedor de email |
| `SMTP_PASS` | Nao | — | Senha ou App Password SMTP. | Provedor de email |
| `SMTP_FROM` | Nao | — | Endereco remetente. Ex: `FlowDesk <noreply@empresa.com>`. | — |

### Observability / Sentry

> Sem `SENTRY_DSN`, o Sentry fica desligado (zero overhead). Opcional mas recomendado em prod.

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `SENTRY_DSN` | Nao | — | DSN do projeto Sentry. Sem isso, Sentry desligado. | `sentry.io` > seu projeto > Settings > Client Keys |
| `SENTRY_TRACES_SAMPLE_RATE` | Nao | `0.1` | Taxa de amostragem de traces (0.0 a 1.0). `0.1` = 10%. | — |
| `SENTRY_ENVIRONMENT` | Nao | — | Tag de ambiente no Sentry. Ex: `production`, `staging`. | — |
| `VITE_SENTRY_DSN` | Nao | — | DSN Sentry para o frontend (Vite). Separado do backend. | Mesmo projeto ou projeto separado no Sentry |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Nao | — | Taxa de traces no frontend. | — |
| `VITE_SENTRY_ENVIRONMENT` | Nao | — | Ambiente Sentry no frontend. | — |

### SLA / Cron

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `SLA_CRON_ENABLED` | Nao | `false` | Habilitar cron de SLA reminders. Recomendado `true` em prod. | — |
| `SLA_CRON_INTERVAL_SECONDS` | Nao | `300` | Intervalo em segundos entre execucoes do cron de SLA. | — |

### Frontend (Vite)

> Variaveis com prefixo `VITE_` sao embutidas no build do frontend. Precisam estar definidas em tempo de build.

| Var | Obrigatoria | Default | Descricao | Como obter |
|-----|-------------|---------|-----------|------------|
| `VITE_DEMO_MODE` | Nao | — | Ativar modo demo (dados ficticios + banner). Deixar vazio em prod. | — |

---

## Segurança

- `JWT_SECRET` e `POSTGRES_PASSWORD` **nunca** devem ser commitados. Estao no `.gitignore`.
- Permissoes dos arquivos `.env`: `chmod 600 apps/api/.env && chmod 600 .env`
- Rotacionar `JWT_SECRET` invalida todos os tokens ativos — usuarios precisam re-logar.
- `SLACK_SIGNING_SECRET` e `SLACK_BOT_TOKEN` nao expiram automaticamente, mas podem ser revogados no painel Slack.
