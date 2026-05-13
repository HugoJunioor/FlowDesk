# @flowdesk/api

API REST do FlowDesk — Express + TypeScript + Postgres, seguindo o
padrão modular Just.

## Stack

- **Express 4** + **TypeScript strict**
- **Postgres** via `pg` (pool), com **Knex** apenas para migrations/seeds
- **Zod** validação na borda (HTTP + env)
- **Pino** logger estruturado JSON
- **Helmet, HPP, cors, express-rate-limit** — security
- **bcryptjs, jsonwebtoken** — auth (Fase 3)
- **Jest + supertest** — testes
- **tsx** — dev com hot reload

## Setup local

```bash
cd apps/api
npm install
cp .env.example .env  # ajuste DATABASE_URL e JWT_SECRET
npm run migrate       # cria as tabelas (a partir da Fase 2)
npm run dev           # tsx watch — recarrega ao salvar
```

API sobe em `http://localhost:4000`.

### Postgres em Docker (dev)

Da raiz do monorepo, basta:

```bash
docker compose up -d
```

Sobe Postgres 16 com volume persistente. Conexão default já funciona com
`DATABASE_URL=postgresql://flowdesk:flowdesk@localhost:5432/flowdesk`.

Comandos úteis:
```bash
docker compose logs -f db     # logs do banco
docker compose down            # para o postgres
docker compose down -v         # para + apaga volume (CUIDADO!)
```

## Estrutura

```
apps/api/
├── src/
│   ├── server.ts            # Bootstrap (graceful shutdown, signals)
│   ├── app.ts               # Express setup (helmet, cors, body, routes)
│   ├── config/
│   │   ├── env.ts           # Validação fail-fast das envs com Zod
│   │   └── database.ts      # Pool pg + closePool
│   ├── shared/
│   │   ├── domain/errors/   # DomainError, NotFoundError, ValidationError…
│   │   ├── middlewares/     # request-id, error-handler, validation
│   │   └── logging/         # Pino logger
│   ├── modules/
│   │   ├── _template/       # 🆕 Copie pra criar novos módulos
│   │   └── health/          # /health endpoint
│   └── routes/index.ts      # Composição dos routers
├── knexfile.ts              # Config Knex (migrations + seeds)
├── jest.config.ts
├── tsconfig.json            # Strict + path aliases
├── Dockerfile               # Multi-stage prod
├── package.json
├── .env.example
└── README.md                # Você está aqui
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | tsx watch (recarrega ao salvar) |
| `npm run build` | tsc → dist/ |
| `npm start` | node dist/server.js |
| `npm test` | jest |
| `npm run test:coverage` | jest com coverage |
| `npm run lint` | eslint src/**/*.ts |
| `npm run typecheck` | tsc --noEmit |
| `npm run migrate` | knex migrate:latest |
| `npm run migrate:make <nome>` | cria nova migration ts |
| `npm run seed` | knex seed:run |

## Como criar um novo módulo

```bash
cp -r src/modules/_template src/modules/<nome>
# Renomeie todos os arquivos _template.* → <nome>.*
# Ajuste imports, schemas, entidades, repositório
# Adicione em src/routes/index.ts:
#   import { <nome>Routes } from '@modules/<nome>/<nome>.routes';
#   v1.use('/<nome>s', <nome>Routes);
```

Veja `src/modules/_template/README.md` pra detalhes.

## Convenções da casa

- **Camadas**: `controller → service → repository`. NUNCA o inverso.
- **Erros**: lance `DomainError` (ou subclasse). NUNCA `res.status().json()`
  em controller — sempre `next(err)` pro handler global.
- **Validação**: `validate({ body | query | params })` no router antes
  do controller. Nunca em service.
- **Resposta padronizada**:
  - Sucesso: `{ sucesso: true, dados }` ou paginada
  - Erro (vem do handler): `{ erro: true, mensagem, codigo, detalhes?, requestId }`
- **Path aliases**: `@config/*`, `@shared/*`, `@modules/*`. NUNCA `../../../`.
- **Domínio em pt-BR** (rotas, campos, mensagens). Código em inglês.
- **Tabelas**: prefixo `tb_<nome>` (ex: `tb_usuario`, `tb_demanda`).

## Status atual

Esta API está em construção como parte da migração pro padrão Just.
Ver `docs/ARCHITECTURE.md` na raiz pro plano completo.

- ✅ Fase 1A: skeleton (este PR)
- ⏳ Fase 1B: monorepo (mover frontend pra `apps/web/`)
- ⏳ Fase 2: Postgres + migrations
- ⏳ Fase 3: auth JWT + HttpOnly cookie
- ⏳ Fases 4-7: port dos módulos (auth, notifications, infra, notes, demandas)
- ⏳ Fase 8: frontend refactor (modules co-localizados)
- ⏳ Fase 9: import JSON → Postgres + cleanup Vite plugin
