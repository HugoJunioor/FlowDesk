# Arquitetura — FlowDesk

Documento técnico de referência. Mantenha atualizado quando houver
mudança estrutural relevante.

---

## 1. Visão geral

**FlowDesk** é um sistema de gestão de demandas centradas em **Slack**,
desenvolvido para uso interno da **Just**. Captura demandas vindas dos
canais oficiais, classifica por SLA/prioridade, distribui pra equipe e
fornece dashboards executivos.

**Contexto de operação:**

- 5-20 usuários internos simultâneos
- Servidor on-premise da Just
- Dados reais de cliente (LGPD aplicável — ver `LGPD.md`)
- Single-tenant (uma instalação atende a Just inteira)

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript strict, Vite, Tailwind CSS |
| UI components | shadcn/ui (Radix UI primitives) |
| Roteamento | React Router v6 |
| Formulários | React Hook Form + Zod |
| Estado | React Context + hooks; sem Redux/MobX |
| Backend (dev/preview) | Vite plugin custom (`scripts/stateSync.mjs`) — Node HTTP handler |
| Persistência | Arquivos JSON em `data/` (atomic write) + localStorage no client |
| Auth | PBKDF2 client-side, sessão em localStorage, token bearer para endpoints |
| Integrações | Slack Web API + Slack OAuth (user token) |
| Build | Vite + rolldown (Vite 8 nova engine) |
| Testes | Vitest + Testing Library; 130+ tests unit |
| CI | GitHub Actions: lint, typecheck, test, build, lighthouse, size, gitleaks |
| Hosting (prod) | Servidor on-prem Just rodando `vite preview` via systemd + nginx |

---

## 3. Estrutura do código

```
flowdesk/
├── src/
│   ├── App.tsx                 # Router root
│   ├── main.tsx                # Entrypoint
│   ├── adapters/               # Multi-canal (Slack, Teams plano, Discord plano)
│   │   ├── slackAdapter.ts
│   │   ├── teamsAdapter.example.ts
│   │   └── types.ts            # Interface comum
│   ├── components/
│   │   ├── ui/                 # shadcn primitives
│   │   ├── demandas/           # DemandCard, DemandList, DemandKanban, StaleBadge…
│   │   ├── infra/              # Modal, Sheet das demandas internas
│   │   ├── notifications/      # Bell, popover, prefs card
│   │   ├── reports/            # BI executivo
│   │   ├── auth/               # Login form, change password
│   │   ├── AppLayout.tsx       # Layout master
│   │   └── AppSidebar.tsx      # Navegação lateral
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Login, sessão, lockout, mustChangePassword
│   │   ├── ThemeContext.tsx
│   │   └── LanguageContext.tsx # i18n PT-BR / EN
│   ├── data/
│   │   ├── demandsLoader.ts    # Glob loader: realDemands se existir, senão mock
│   │   ├── mockDemands.ts      # Demo data
│   │   └── realDemands.ts      # 🔒 gitignored — dados reais Slack
│   ├── hooks/
│   │   ├── usePermissions.ts
│   │   └── use-toast.ts
│   ├── lib/                    # 🧠 Lógica de negócio reutilizável
│   │   ├── apiClient.ts        # HTTP client (slack/, /infra/, /notifications/, /notes/)
│   │   ├── authStorage.ts      # CRUD users, hash senhas, bootstrap master
│   │   ├── businessHours.ts    # SLA em horário comercial (feriados BR)
│   │   ├── slaCalculator.ts    # SLA 1ª resposta + resolução
│   │   ├── slaReminderEngine.ts # demand_due_soon + demand_overdue
│   │   ├── staleInteraction.ts # "X sem interação"
│   │   ├── priorityClassifier.ts # IA-driven P1/P2/P3
│   │   ├── closureClassifier.ts  # Categorização de fechamento
│   │   ├── statusAnalyzer.ts   # Detecta status via reactions
│   │   ├── notificationEvents.ts # Disparo dos eventos
│   │   ├── browserNotifications.ts # Notification API
│   │   ├── reportGenerator.ts  # BI HTML auto-generated
│   │   ├── excelExporter.ts    # XLSX export
│   │   ├── crypto.ts           # PBKDF2, UUID
│   │   └── channelRouting.ts   # Slack channel → módulo
│   ├── pages/                  # Uma rota = um page component
│   │   ├── Index.tsx           # Dashboard /
│   │   ├── Demandas.tsx        # /demandas (Slack)
│   │   ├── DemandasSql.tsx     # /demandas-sql (canal SQL isolado)
│   │   ├── Infra.tsx           # /infra (internas)
│   │   ├── Notas.tsx           # /notas (bloco de notas pessoal)
│   │   ├── Notificacoes.tsx    # /notificacoes (inbox)
│   │   ├── Configuracoes.tsx
│   │   ├── UserManagement.tsx
│   │   ├── GroupsManagement.tsx
│   │   ├── ChannelRouting.tsx
│   │   └── Login.tsx
│   ├── types/                  # Tipos compartilhados
│   │   ├── demand.ts           # SlackDemand, ThreadReply, ClosureFields
│   │   ├── auth.ts             # FlowDeskUser, UserRole
│   │   ├── permissions.ts      # ModuleId, Permission, GroupPermissions
│   │   ├── notification.ts     # NotificationEvent, NotificationItem, Prefs
│   │   └── note.ts             # Note, ChecklistItem, NoteStatus
│   └── test/                   # Setup global de testes
├── scripts/
│   ├── stateSync.mjs           # 🔌 Plugin Vite — Node HTTP "backend"
│   ├── syncSlack.cjs           # Importa demandas do Slack (gera realDemands.ts)
│   ├── syncSqlChannel.cjs      # Sync isolado do canal SQL
│   ├── syncWatch.cjs           # Watcher pra rodar syncs em loop
│   ├── preflight.cjs           # Health check antes de build
│   └── resetUserPassword.cjs   # Util ops
├── data/                        # 🔒 gitignored
│   ├── shared-state.json       # localStorage sincronizado entre origens
│   ├── auth-token              # Token bearer dos endpoints
│   ├── infraDemands.json       # Demandas internas
│   ├── notifications.json      # Inbox de notificações
│   ├── notificationPreferences.json
│   ├── notes.json              # Bloco de notas por usuário
│   └── backups/                # Rotação de 20 backups
├── docs/
│   ├── ARCHITECTURE.md         # Este arquivo
│   ├── DEPLOY.md
│   ├── RUNBOOK.md
│   └── LGPD.md
└── .github/workflows/          # CI pipelines
```

---

## 4. Componentes principais

### 4.1. Frontend (SPA)

Single-page app servida pelo Vite preview. Estado em React Context +
localStorage; chamadas HTTP para o backend via `apiClient`.

**Rotas principais:**

```
/                Dashboard executivo
/demandas        Lista/Kanban de demandas Slack
/demandas-sql    Demandas do canal #operacoes-sql (isolado)
/infra           Demandas internas (SQL/Deploy)
/notas           Bloco de notas pessoal (Kanban + Lista)
/notificacoes    Inbox + filtros
/configuracoes   Preferências (tema, idioma, notificações)
/usuarios        Gestão (master only)
/grupos          Permissões por grupo (master only)
/grupos-demandas Roteamento de canais (master only)
/perfil          Perfil do user logado
```

### 4.2. Backend (Vite plugin)

`scripts/stateSync.mjs` é um plugin Vite que adiciona middleware HTTP
para servir endpoints REST. Funciona **tanto em `vite dev` quanto em
`vite preview`**.

**Endpoints expostos:**

```
GET    /health                    (sem auth) — monitoring
GET    /healthz                   (alias)

GET    /__state                   Estado compartilhado (localStorage espelhado)
PUT    /__state/:key              Atualiza chave
GET    /__token                   (LAN only) Token de auth pra novos devices

POST   /auth/slack/redirect       OAuth Slack
GET    /auth/slack/callback

GET    /slack/channels            (autenticado) Lista canais
POST   /slack/reply               Posta mensagem
POST   /slack/upload              Upload de arquivo
…

GET    /infra/                    CRUD demandas internas
POST   /infra/
PATCH  /infra/:id
DELETE /infra/:id

GET    /notifications             Inbox por user
POST   /notifications             Cria nova
PATCH  /notifications/:id         Marca lida/não lida
POST   /notifications/mark-all-read
GET    /notifications/preferences
PUT    /notifications/preferences

GET    /notes                     CRUD notas pessoais (?email=...)
POST   /notes
PATCH  /notes/:id?email=...       Valida ownership server-side
DELETE /notes/:id?email=...
```

**Características:**

- Não usa Express/Fastify — handler nativo Node.js
- Auth: bearer token em header `X-FlowDesk-Token` (ou cookie fallback)
- CORS: allowlist via `FLOWDESK_ALLOWED_ORIGINS` env (em prod) ou
  fallback dev (LAN/Tailscale/loopback)
- Rate limit por IP+categoria (auth: 10/min, writes: 60/min, GETs: 300/min)
- Logs estruturados JSON Lines (filtros via `FLOWDESK_LOG_LEVEL`)

---

## 5. Fluxo de dados

### 5.1. Sync Slack → demandas processadas

```
┌──────────┐    syncSlack.cjs        ┌─────────────────────┐
│  Slack   │ ─────────────────────▶  │ src/data/           │
│  API     │  (Node script local)    │ realDemands.ts      │
└──────────┘                         │ (gitignored)        │
                                     └─────────┬───────────┘
                                               │
                                               ▼ import.meta.glob
                                     ┌─────────────────────┐
                                     │ demandsLoader.ts    │
                                     │  • autoClassify     │
                                     │  • statusAnalyzer   │
                                     │  • closure          │
                                     │  • overrides        │
                                     └─────────┬───────────┘
                                               │
                                               ▼
                                     ┌─────────────────────┐
                                     │ Pages (Demandas,    │
                                     │ Index, etc.)        │
                                     └─────────────────────┘
```

**Detalhes:**

1. **syncSlack.cjs** roda local (não no servidor de prod) e grava
   `src/data/realDemands.ts` (gitignored, vai por backup)
2. **demandsLoader.ts** carrega via `import.meta.glob` (eager); se
   `realDemands.ts` não existe, usa `mockDemands.ts`
3. **autoClassifyDemands** aplica regras de auto-atribuição + classificação
   AI-driven de prioridade (priorityClassifier)
4. **processDemandsStatus** detecta status real via reactions na thread
5. **applyOverrides** aplica edições manuais (status, assignee, closure)
   que ficaram em localStorage compartilhado

### 5.2. Demandas internas (Infra)

```
UI (NewInfraDemandModal)
    │ POST /infra
    ▼
stateSync.mjs handleInfra()
    │ writeInfraDemands() atomic
    ▼
data/infraDemands.json
    │
    ▼ (polling 10s ou refresh)
UI (Infra page)
```

Sem dependência de Slack — fluxo 100% interno.

### 5.3. Notificações

```
Evento (ex: demanda atribuída)
    │
    ▼
notificationEvents.notifyAssigned()
    │
    ▼ POST /notifications
stateSync.handleNotifications()
    │ writeNotifications() atomic + FIFO 500
    ▼
data/notifications.json
    │
    ▼ (NotificationBellSidebar polling 30s)
UI + (se push enabled) browser Notification API
```

### 5.4. SLA reminders

```
NotificationBellSidebar (polling 30s)
    │
    ▼ runSlaReminderCheck({user, prefs, demands})
slaReminderEngine
    │ pra cada demanda:
    │   minutos uteis até dueDate
    │   compara com prefs.slaReminders.p{1,2,3}Hours
    │ anti-spam via localStorage fd_sla_reminders_sent
    │
    ▼ notify(demand_due_soon | demand_overdue)
…volta pro fluxo de notificações
```

---

## 6. Persistência

### 6.1. Arquivos JSON (servidor)

Todos em `data/` (gitignored). Escrita **atômica** (`.tmp` + `rename`)
para evitar corrupção em caso de crash:

```js
const tmp = FILE + ".tmp";
fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
fs.renameSync(tmp, FILE);
```

Permissão **600** (só owner lê/escreve).

**Capacidade:** com 20 usuários e ~500 demandas ativas, `infraDemands.json`
fica em ~500KB; `notifications.json` em ~200KB (cap de 500 FIFO).

### 6.2. localStorage (cliente)

Chaves prefixadas com `fd_`:

```
fd_users_v2                Lista de usuários (com hash de senha)
fd_session_v2              Sessão ativa
fd_demand_overrides        Overrides manuais de demandas Slack
fd_sql_demand_overrides    Overrides do módulo SQL (isolado)
fd_groups                  Lista de grupos
fd_group_permissions       Permissões por grupo
fd_auto_assign_rules       Regras de auto-atribuição
fd_support_members         Membros do suporte
fd_channel_routing         Slack channel → módulo
fd_infra_databases         Lista de bancos
fd_login_rl_<login>        Rate limit por usuário (lockout)
fd_last_push_ids           Anti-dup de browser push
fd_sla_reminders_sent      Anti-spam SLA reminders
```

**Sincronização cross-origin:** chaves marcadas em `SYNCED_KEYS`
(`stateSync.mjs`) são espelhadas no servidor (`data/shared-state.json`),
permitindo que múltiplos devices na mesma rede vejam o mesmo estado.

---

## 7. Autenticação e autorização

### 7.1. Login flow

```
User submete login/senha
    │
    ▼
1. Rate limit check (localStorage fd_login_rl_<login>)
   – Bloqueia se >5 tentativas em 15min
    │
    ▼
2. Busca user por login
3. Verifica status != "blocked"
4. checkPasswordAndMigrate(user, password)
   – PBKDF2 SHA-256 com salt + 150k iterações
   – Migra hashes legados SHA-256 → PBKDF2 silenciosamente
    │ ok
    ▼
5. setSession(user) → fd_session_v2 (TTL 8h)
6. Se user.isFirstAccess → força changePassword
7. Redirect pra rota inicial
```

### 7.2. RBAC (Role-Based Access Control)

```
FlowDeskUser.role: "master" | "user"

Master: acesso TOTAL, bypass de checks de grupo
User:   recebe UNIÃO das permissões de todos os grupos
        em que participa (FlowDeskUser.groups: string[])

GroupPermissions {
  name: "Suporte" | "Desenvolvimento" | ...,
  modules: {
    demandas: ["view", "edit"],
    demandas_sql: ["view"],
    ...
  }
}

Permission: "view" | "create" | "edit" | "delete" | "export"
```

**8 módulos × 5 ações** = 40 combinações granulares.

`usePermissions()` hook expõe `canSee(module)`, `canDo(module, action)`,
usado em sidebar (esconder rotas) e em botões (desabilitar/esconder).

### 7.3. Bearer token (endpoints do servidor)

- Gerado uma vez no boot do servidor → `data/auth-token` (256 bits)
- Devices na LAN/Tailscale pegam via `GET /__token` (externos rejeitados)
- Enviado em header `X-FlowDesk-Token` ou cookie fallback
- Validação em **tempo constante** (`crypto.timingSafeEqual`) — anti
  timing attack

---

## 8. Multi-canal (adapter pattern)

`src/adapters/types.ts` define interface comum:

```ts
interface ChannelAdapter {
  send(channel: string, text: string): Promise<{ok: boolean; ts: string}>;
  upload(channel: string, file: Buffer, name: string): Promise<…>;
  listMembers(channel: string): Promise<Member[]>;
  parseDemand(message: SlackMessage): SlackDemand;
}
```

**Implementações:**

- ✅ `slackAdapter.ts` — em produção
- 📋 `teamsAdapter.example.ts` — exemplo de skeleton
- ⏳ Discord — planejado, sem implementação ainda

Trocar canal não exige rewrite — só implementar o adapter.

---

## 9. Build e deploy

### 9.1. Build

```bash
npm ci
npm run build
# Saída: dist/
```

Vite com **rolldown** (engine nova, mais rápida que esbuild/swc). Bundle
total ~5MB minificado, ~1.3MB gzipped. **TODO:** code splitting por rota
(`React.lazy`).

### 9.2. Deploy on-prem

Detalhe completo em [DEPLOY.md](./DEPLOY.md). Resumo:

```
nginx (HTTPS, HSTS, headers)
    │
    └─▶ 127.0.0.1:4173
        └─▶ npm run preview (systemd flowdesk.service)
            ├─▶ Serve dist/ estático
            └─▶ stateSync plugin handler (endpoints REST)
```

Sem container, sem orquestrador. Vai direto pra systemd. **Para 5-20
usuários internos isso é suficiente** — overhead de Docker/k8s não compensa.

---

## 10. CI/CD

```
push em branch / PR
    ▼
GitHub Actions:
  ✓ Lint (eslint)
  ✓ Typecheck (tsc --noEmit)
  ✓ Test (vitest, 130+ unit tests)
  ✓ Build (vite build)
  ✓ Build Storybook
  ✓ Lighthouse CI (perf, a11y)
  ✓ Size (bundle size check)
  ✓ Gitleaks (varredura de secrets vazados)
  ✓ Vercel preview deploy (demo)
    ▼
Merge em main → release-please cria release tag
```

**Branch protection:**

- Main requer status checks passing
- Squash merge only
- Required reviewers (admin pode override em emergência)

---

## 11. Decisões arquiteturais relevantes

### ADR-001: Persistência em JSON files

**Status:** Aceito | **Data:** 2026-04 | **Revisar quando:** >100 usuários

**Contexto:** Sistema interno com 5-20 usuários, sem necessidade de queries
complexas, multi-tenant ou alta concorrência.

**Decisão:** Usar arquivos JSON em `data/` em vez de Postgres.

**Consequências:**
- ✅ Zero infra de banco. Backup é `tar` simples.
- ✅ Inspecionável a olho. Recovery é trivial.
- ✅ Funciona em qualquer servidor com Node.
- ❌ Escala falha em ~mil+ registros. Sem queries indexadas.
- ❌ Sem transações ACID (mitigado por atomic write).
- ❌ Concorrência por write lock implícito do fs (OK pra 20 users).

### ADR-002: Backend dentro do Vite plugin

**Status:** Aceito | **Data:** 2026-04 | **Revisar quando:** Vite mudar API ou >50 users

**Contexto:** Time pequeno, ferramenta interna, deploy on-prem.

**Decisão:** Implementar backend como plugin Vite (`scripts/stateSync.mjs`)
em vez de servidor Express/Fastify separado.

**Consequências:**
- ✅ Um único processo Node em prod (`vite preview`).
- ✅ Hot reload em dev sem precisar gerenciar dois processos.
- ✅ Mesma config TS/lint dos arquivos client.
- ❌ Acoplado à API do Vite. Se Vite mudar, refator.
- ❌ Build estático (Vercel, S3) não roda o plugin → algumas features
  não funcionam em deploy só-frontend.

### ADR-003: Auth em localStorage com PBKDF2 client-side

**Status:** Aceito | **Data:** 2026-04 | **Revisar quando:** abrir pra usuários externos

**Contexto:** Sistema interno, supervisor da Just controla quem tem login.

**Decisão:** Hash de senha PBKDF2 client-side (150k iterações), sessão em
localStorage com TTL 8h. Sem JWT signed server-side.

**Consequências:**
- ✅ Implementação simples, zero infra extra.
- ✅ Senha nunca trafega em texto plano (PBKDF2 no cliente).
- ❌ Não há revogação imediata de sessão (TTL 8h fixo).
- ❌ Em XSS, atacante acessa localStorage → CSP em produção mitiga.
- ❌ Não escala pra federação SSO / OAuth interno.

### ADR-004: Polling em vez de WebSocket

**Status:** Aceito | **Data:** 2026-04

**Contexto:** 5-20 usuários, atualização real-time não crítica.

**Decisão:** Polling de 10s (Infra, Notas) e 30s (sino de notificações).

**Consequências:**
- ✅ Stack simples, sem servidor de sockets.
- ✅ Trivial debug, funciona atrás de proxies/firewalls corporativos.
- ❌ ~6 req/min por aba aberta. Com 20 users × 3 abas = 360 req/min.
  Suporta tranquilo. Para >100 users, considerar SSE.

### ADR-005: SLA reminders no frontend

**Status:** Aceito com ressalva | **Data:** 2026-05 | **Revisar:** se reminder offline for crítico

**Contexto:** Engine roda no polling do sino (frontend), só dispara
notificações quando user tem aba aberta.

**Decisão:** Aceitar essa limitação por simplicidade.

**Consequências:**
- ✅ Zero infra de cron/worker.
- ❌ Se user offline, reminder não dispara até ele abrir.
- ⚠️ **Risco:** demanda P1 vencendo às 2h da manhã não notifica até
  alguém logar no dia seguinte. Para Just isso é aceitável (P1
  raramente passa da noite sem assignee online). **Mitigação futura:**
  cron job server-side que dispare e-mail (Resend) — não exige
  navegador aberto.

---

## 12. Segurança (resumo)

| Vetor | Mitigação |
|---|---|
| Brute-force login | Rate limit + lockout 15min após 5 tentativas |
| Brute-force API | Rate limit por IP+categoria (10/60/300 req/min) |
| CORS | Allowlist exata via `FLOWDESK_ALLOWED_ORIGINS` |
| CSRF | Bearer token em header (não cookie sozinho) |
| XSS | React escape automático + CSP no nginx |
| Clickjacking | X-Frame-Options: DENY |
| MITM | HTTPS obrigatório + HSTS |
| Timing attack | `crypto.timingSafeEqual` na validação de token |
| Secrets vazados | Gitleaks no CI + `.env` sempre gitignored |
| File corruption | Atomic write (`.tmp` + `rename`) |
| Memory leak | Rate buckets com TTL + cleanup `.unref()` periódico |
| Senhas | PBKDF2 SHA-256, 150k iterações, salt aleatório por user |
| Path traversal | Sem rotas dinâmicas com `req.url` em paths de arquivo |

Detalhe LGPD em [LGPD.md](./LGPD.md).

---

## 13. Limitações conhecidas

1. **Backup só local** — RUNBOOK orienta cron pra outro servidor;
   responsabilidade do operador.
2. **Sem soft-delete em algumas entidades** — operações destrutivas
   (deletar usuário, demanda) são definitivas. Backups são a única
   recuperação. (Nota: tb_demanda, tb_nota, tb_usuario já tem soft
   delete via `excluido_em`.)
3. **Single instance** — sem failover. Se o servidor cai, sistema fora
   até reiniciar (~30s com systemd restart).
4. **AuthContext legacy ainda em uso** — frontend tem dois sistemas em
   paralelo (`/login` legacy localStorage + `/login-v2` JWT cookie).
   Migração total prevista pra próxima fase.
5. **Notificações cross-device** dependem de polling de 30s — não há
   push instantâneo entre dispositivos.

---

## 14. Pós-migração — estado atual

A migração pro padrão Just terminou (1A-9 + extensões). O sistema
agora tem:

### Backend (`apps/api/`)
- Express + Postgres + Knex (migrations versionadas)
- JWT HS256 + HttpOnly refresh cookie + rotação
- 7 módulos no padrão: `auth`, `notificacao`, `nota`, `demanda` (+ thread),
  `sla`, `auditoria`, `health` + `_template`
- Pino structured logs + Sentry opt-in + Audit middleware automático
- SLA cron server-side (substitui polling do frontend)
- E2E + unit tests (85+ no api)

### Frontend (`apps/web/`)
- Monorepo workspace
- Stack legacy (em `pages/`) coexistindo com stack v2 (em `modules/`)
- 5 módulos no padrão Just: `auth`, `auditoria`, `nota`, `notificacao`,
  `demanda` + `configuracoes` (consome notificacao)
- 6 telas v2 funcionais (sidebar BETA master-only):
  `/login-v2`, `/auditoria`, `/notas-v2`, `/notificacoes-v2`,
  `/configuracoes-v2`, `/demandas-v2` (+ DemandaDetalheSheet com
  threadReplies)
- axios + React Query + Sentry + code splitting por rota
- 18 specs E2E Playwright (smoke + login-v2 + v2-pages)

### Próximas evoluções recomendadas
1. **Wiring do AuthContext** — substituir AuthContext legacy pelo
   `useMe` do módulo auth. Risco médio (qualquer regressão quebra
   login). Sugiro fazer em paralelo a `/login-v2` como toggle.
2. **Migrar páginas legacy** uma a uma pra modules. Padrão já
   estabelecido. Cada página = 1 PR pequeno.
3. **Audit log retention** (cron de purge >90 dias)
4. **WebSocket/SSE** se passar de 100 usuários simultâneos
5. **Postgres + servidor dedicado** se virar SaaS multi-tenant

---

## 15. Glossário

- **Demanda Slack** — Mensagem postada em canal monitorado que vira card no FlowDesk
- **Demanda Infra** — Demanda interna criada direto no FlowDesk (SQL/Deploy)
- **SLA 1ª resposta** — Tempo até primeira resposta da equipe na thread
- **SLA resolução** — Tempo até demanda ser marcada como `concluida`
- **isTeamMember** — Reply de funcionário Just (não cliente)
- **closure** — Campos de fechamento (categoria, motivo, nível de suporte)
- **Override** — Edição manual que sobrescreve dados vindos do sync
- **stale** — Demanda sem interação da equipe há >24h úteis
- **Horas úteis** — Seg-Sex 8h-18h, exclui feriados BR (algoritmo Meeus)

---

**Última atualização:** 2026-05-12 — versão inicial pré-produção.
