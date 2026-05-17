# Dev full-stack (web + API + Postgres)

Guia para subir o stack completo localmente do zero.
Testado em Windows 11 (PowerShell) e Ubuntu 22.04.

---

## Pre-requisitos

- **Node.js 20** — versao definida em `.nvmrc`. Com nvm: `nvm use`
- **npm 10+** — vem junto com Node 20
- **Docker Desktop** (Windows/Mac) ou **Docker Engine** (Linux) — para o Postgres
- **pg_dump** no PATH — necessario apenas para o comando `npm run backup`
- **Slack bot token** — opcional para dev; obrigatorio se quiser sincronizacao real com o Slack

---

## Passos

### 1. Clonar o repositorio

```bash
git clone <url-do-repo>
cd op-es-suaves
```

### 2. Instalar dependencias

```bash
npm install --legacy-peer-deps
```

### 3. Configurar variaveis de ambiente

Raiz (frontend + scripts Slack):

```bash
cp .env.example .env
```

API (backend Express + Postgres):

```bash
cp apps/api/.env.example apps/api/.env
```

Ajuste obrigatorio em `apps/api/.env`: o `.env.example` lista `localhost:5173` em `ALLOWED_ORIGINS`, mas o Vite sobe na porta `8080`. Corrija:

```
ALLOWED_ORIGINS=http://localhost:8080
```

Para dev local sem Slack real, o restante dos valores padrao do `.env.example` ja funciona.

### 4. Subir o Postgres

```bash
docker compose up -d
```

Isso sobe `postgres:16-alpine` no container `flowdesk-postgres`, porta `5432`.
Credenciais configuradas no `docker-compose.yml`:

| Parametro | Valor        |
|-----------|--------------|
| User      | `flowdesk`   |
| Password  | `flowdesk`   |
| Database  | `flowdesk`   |
| Port      | `5432`       |

A `DATABASE_URL` correspondente (ja no `.env.example` da API):

```
DATABASE_URL=postgresql://flowdesk:flowdesk@localhost:5432/flowdesk
```

Aguarde o healthcheck ficar verde antes de prosseguir:

```bash
docker compose logs -f db
# Aguarda: "database system is ready to accept connections"
```

### 5. Rodar migrations e seed

```bash
npm run migrate -w @flowdesk/api
npm run seed -w @flowdesk/api
```

`migrate` aplica todas as migrations pendentes via Knex.
`seed` insere dados iniciais, incluindo o usuario `master`.

### 6. (Opcional) Importar dados de JSON

Se houver dump JSON de demandas para importar:

```bash
npm run import:json -w @flowdesk/api
```

### 7. Iniciar a API

```bash
npm run dev:api
```

Sobe em `http://localhost:4000` com hot reload via `tsx watch`.

### 8. Iniciar o frontend

Em outro terminal:

```bash
npm run dev:web
```

Sobe em `http://localhost:8080` via Vite.

Alternativa que sobe web + sync Slack + realtime em paralelo:

```bash
npm run dev:all
```

### 9. Acessar a aplicacao

Abra `http://localhost:8080`.

Login inicial:

| Campo | Valor     |
|-------|-----------|
| Usuario | `master` |
| Senha   | `Admin@1` |

### 10. Troca de senha obrigatoria

No primeiro login o sistema exige troca de senha. Defina uma senha forte e salve.

---

## Verificacao

### Status da API

```bash
curl http://localhost:4000/status
```

Resposta esperada: bolinha verde, `version` e `uptime`.

### Health detalhado

```bash
curl -X POST http://localhost:4000/health/detailed
```

Resposta esperada:

```json
{
  "checks": {
    "database": "ok",
    "disk": "ok",
    "memory": "ok"
  }
}
```

### Auditoria no frontend

Acesse `/auditoria` — deve exibir os entries de login do usuario `master`.

---

## Backup

```bash
npm run backup
```

Executado na raiz. Gera dois arquivos em `backups/`:

- `flowdesk-backup-YYYYMMDD-HHmmss.sql` — dump do Postgres via `pg_dump`
- `flowdesk-backup-YYYYMMDD-HHmmss.zip` — snapshot de `apps/web/data/` (tokens, overrides locais)

Retencao automatica: os 7 backups mais recentes de cada tipo sao mantidos; os mais antigos sao removidos.

Requisito: `pg_dump` precisa estar no PATH (vem com o cliente Postgres ou `postgresql-client` no Linux).

---

## Troubleshooting

**Postgres nao sobe**

Porta 5432 ja esta em uso (outro Postgres local ou servico do sistema).
Opcoes: parar o processo conflitante ou alterar a porta em `docker-compose.yml`:

```yaml
ports:
  - '5433:5432'   # expoe na 5433 localmente
```

Lembre de atualizar `DATABASE_URL` em `apps/api/.env` para a nova porta.

---

**401 na UI apos algum tempo**

Token JWT expirou. Clique em logout e faca login novamente.
TTLs configurados em `apps/api/.env`: `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`.

---

**Slack `not_authed` ou sync nao funciona**

Variavel de sessao PowerShell sobrepondo o `.env`:

```powershell
Remove-Item Env:SLACK_BOT_TOKEN
```

Depois re-execute o script de sync.

---

**CORS error no browser**

Confirme que `apps/api/.env` tem a origem correta:

```
ALLOWED_ORIGINS=http://localhost:8080
```

O `.env.example` padrao usa `localhost:5173` (porta padrao do Vite sem config), mas o projeto esta configurado para `8080` em `apps/web/vite.config.ts`.

---

**Demandas vazias**

Puxe as demandas do Slack manualmente:

```bash
npm run sync -w @flowdesk/web
```

---

**Docker: volume com dados antigos incompativeis**

Se as migrations falharem apos uma mudanca de schema incompativel, remova o volume e recomece:

```bash
docker compose down -v   # ATENCAO: apaga todos os dados do Postgres local
docker compose up -d
npm run migrate -w @flowdesk/api
npm run seed -w @flowdesk/api
```
