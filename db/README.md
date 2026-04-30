# Banco de dados — FlowDesk em produção

## Engine alvo
PostgreSQL 14+ (testado). Compatível com AWS RDS, Cloud SQL, Supabase, Neon e Postgres self-hosted.

## Aplicar o schema

```bash
# 1) Aplica DDL (idempotente)
psql "$DATABASE_URL" -f db/schema.sql

# 2) Gera o seed a partir do estado local do Hugo (rodar na máquina dele)
node scripts/exportToSql.cjs > db/seed-from-local.sql

# 3) Cezar aplica o seed em produção
psql "$DATABASE_URL" -f db/seed-from-local.sql
```

## Estrutura

| Tabela              | Origem (localStorage / arquivo)         |
|---------------------|-----------------------------------------|
| `users`             | `fd_users_v2`                           |
| `groups`            | `fd_group_permissions` + `fd_groups`    |
| `user_groups`       | derivado de `users[i].groups`           |
| `support_members`   | `fd_support_members`                    |
| `auto_assign_rules` | `fd_auto_assign_rules`                  |
| `demand_overrides`  | `fd_demand_overrides` + `fd_sql_demand_overrides` (channel='slack'/'sql') |
| `sessions`          | nova — server-side se backend gerenciar |
| `api_tokens`        | nova — substitui `data/auth-token`      |
| `audit_log`         | nova — recomendado em prod              |

## Decisões de design

- **JSONB** para campos profundamente aninhados (`override`, `rule`, `theme_preferences`, `modules`). Permite evoluir o schema sem migrations toda vez que o front muda.
- **CITEXT** para `login`, `email`, `group.name` — comparações case-insensitive sem `LOWER()` espalhado.
- **`pgcrypto`** para `gen_random_uuid()`. UUIDs do front (`generateUUID()` em `src/lib/crypto.ts`) são preservados quando importados.
- **Triggers `updated_at`** em todas as tabelas com edição.
- **Hash de senha** continua PBKDF2 no formato `pbkdf2$<iters>$<salt>$<hash>` (gerado por `src/lib/crypto.ts`). O backend valida igual ao front.

## Senha do master no seed

O seed inicial em `schema.sql` traz um placeholder `pbkdf2$150000$REPLACE_SALT_HEX$REPLACE_HASH_HEX`. Em produção:

1. **Recomendado**: rodar `exportToSql.cjs` na máquina do Hugo — o hash real do master sai junto.
2. **Alternativa**: gerar hash novo:
   ```js
   // node REPL com tsx ou similar
   import { hashPassword } from './src/lib/crypto';
   console.log(await hashPassword('SenhaForteAqui'));
   ```
   E substituir no `schema.sql` antes de aplicar.

## Backup e restore

```bash
# Backup completo
pg_dump "$DATABASE_URL" -Fc -f flowdesk-$(date +%Y%m%d).dump

# Restore
pg_restore -d "$DATABASE_URL" --clean --if-exists flowdesk-YYYYMMDD.dump
```

Em produção configurar `pg_dump` automático diário (RDS snapshot, Cloud SQL automated backup, ou cron job).

## Variáveis de ambiente esperadas pelo backend

```env
DATABASE_URL=postgres://flowdesk:senha@host:5432/flowdesk
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_IDS=C1234,C5678
NODE_ENV=production
SESSION_SECRET=<32+ bytes random>
```
