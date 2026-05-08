# FlowDesk

[![CI](https://github.com/HugoJunioor/FlowDesk/actions/workflows/ci.yml/badge.svg)](https://github.com/HugoJunioor/FlowDesk/actions/workflows/ci.yml)
[![Secrets Scan](https://github.com/HugoJunioor/FlowDesk/actions/workflows/secrets-scan.yml/badge.svg)](https://github.com/HugoJunioor/FlowDesk/actions/workflows/secrets-scan.yml)
[![codecov](https://codecov.io/gh/HugoJunioor/FlowDesk/graph/badge.svg)](https://codecov.io/gh/HugoJunioor/FlowDesk)
[![Demo](https://img.shields.io/badge/demo-online-success?style=flat&logo=vercel)](https://flow-desk-e2is.vercel.app)
[![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20TypeScript%20%2B%20Vite-blue?style=flat)](#stack)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat)](LICENSE)

Sistema de gestão de demandas que chegam via Slack. Centraliza atendimentos
dispersos em conversas num painel gerencial com SLA, métricas, relatórios
BI/Excel e controle granular de permissões.

## 📸 Screenshots

### Dashboard executivo
Métricas em tempo real, gráficos por cliente, prioridade e SLA.

![Dashboard claro](docs/screenshots/dashboard-light.png)
![Dashboard escuro](docs/screenshots/dashboard-dark.png)

### Gestão de demandas (Kanban)
Cards com prioridade, SLA em horas úteis, classificação automática e ações rápidas.

![Kanban](docs/screenshots/kanban.png)

### Classificação automática por IA
Cada demanda recebe prioridade sugerida com nível de confiança e *reasoning* explícito — auditável.

![Classificação automática](docs/screenshots/ai-classification.png)

### Relatório BI interativo
Gera HTML autocontido com gráficos, timelines e análise por cliente, prioridade e canal.

![Relatório BI](docs/screenshots/bi-report.png)

### Grupos e permissões granulares
Matriz de 8 módulos × 5 ações por grupo, união automática quando o usuário pertence a vários.

![Grupos](docs/screenshots/permissions-overview.png)
![Matriz](docs/screenshots/permissions-matrix.png)

### Login
![Login](docs/screenshots/login.png)

## 🌐 Demo ao vivo

**🔗 [flow-desk-e2is.vercel.app](https://flow-desk-e2is.vercel.app)**

| Campo | Valor |
|---|---|
| Login | `master` |
| Senha | `Admin@1` |

A demo roda com dados fictícios (10 demandas com prioridades, SLAs e
clientes variados). Cada visitante tem seu próprio estado isolado no
navegador — pode criar usuários, mexer em overrides, exportar relatórios
sem afetar outros visitantes.

## ⚡ Backend integrado

Os endpoints `/slack/*` e `/auth/slack/*` rodam direto no Vite dev server
via plugin (`scripts/stateSync.mjs`) — sem dependência de servidor externo.

- 🔐 **Slack User OAuth** — cada usuário conecta a própria conta pelo perfil
  pra postar com identidade real (não como bot)
- 📤 **Reply / upload / edit / delete** mensagens em threads
- 👥 **Channel members** pra autocomplete de @mention
- 💾 **Persistência local** em `data/` (gitignored) — tokens, overrides, estado

## 🏗 Arquitetura

```mermaid
flowchart LR
    A[Slack / Teams / Email] -->|Adapter| B[DemandAdapter]
    B --> C[SlackDemand normalizado]
    C --> D[Pipeline]
    D --> E[Auto-classificação]
    D --> F[Análise de status]
    D --> G[SLA em horas úteis]
    D --> H[Overrides do master]
    E & F & G & H --> I[UI]
    I --> J[Dashboard]
    I --> K[Kanban]
    I --> L[Relatórios BI/Excel]
    H -.persiste.-> M[(Postgres / localStorage)]
```

Camadas desacopladas: **adapter** (fonte) → **pipeline** (lógica de
negócio) → **UI** (apresentação) → **storage** (persistência). Trocar
qualquer camada não afeta as outras.

## 🔌 Multi-canal

Sistema **não acoplado ao Slack**. A arquitetura suporta nativamente
qualquer plataforma de chat — basta criar um adapter de ~80 linhas.

| Canal              | Status     |
|--------------------|------------|
| Slack              | ✅ Produção |
| Microsoft Teams    | 📋 Stub pronto |
| Discord            | ⏳ Roadmap |
| WhatsApp Business  | ⏳ Roadmap |
| E-mail (IMAP)      | ⏳ Roadmap |
| Telegram           | ⏳ Roadmap |

Detalhes técnicos em [`src/adapters/README.md`](./src/adapters/README.md).

## Funcionalidades

- 📊 **Dashboard executivo** com métricas, gráficos por prioridade/cliente e
  visão anual mês a mês
- 📋 **Gestão de demandas** em lista, kanban, agrupamentos por data,
  prioridade ou responsável
- 🔄 **Sincronização automática** com Slack a cada 5 minutos
- ⏱ **SLA em horas úteis** (Seg-Sex 8-18, descontando feriados nacionais
  e municipais)
- 🗂 **Módulo isolado** para demandas técnicas com regras próprias
- 👥 **Grupos e permissões granulares** (8 módulos × 5 ações)
- 🌍 **Multi-idioma** (PT-BR, EN-US, ES-ES) por usuário
- 🎨 **16 temas de cores** com modo claro/escuro
- 📤 **Relatórios** em BI (HTML interativo) e Excel formatado
- 🔐 **Autenticação** por usuário com sessão de 8h e troca obrigatória
  no primeiro acesso
- 🔗 **Estado compartilhado** entre dispositivos via VPN/rede mesh

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Roteamento:** react-router-dom
- **Gráficos:** Recharts
- **Slack:** @slack/web-api
- **Excel:** xlsx-js-style
- **Forms:** react-hook-form + zod

## Pré-requisitos

- Node.js 20 (use `.nvmrc`: `nvm use`)
- npm
- Token de bot Slack com escopos: `channels:history`, `channels:read`,
  `groups:read`, `users:read`, `reactions:read`, `chat:write`, `files:write`
- Slack App OAuth (opcional, pra postar como usuário real):
  `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`

## Instalação

```bash
git clone https://github.com/HugoJunioor/flowdesk.git
cd flowdesk
npm install --legacy-peer-deps
cp .env.example .env
# Edite .env com seu SLACK_BOT_TOKEN, SLACK_WORKSPACE e TEAM_MEMBERS
```

## Comandos disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (porta 8080) |
| `npm run dev:all` | Dev + sync automático em paralelo (recomendado) |
| `npm run dev:vpn` | Dev + sync + lista IPs (rede mesh/VPN) |
| `npm run build` | Build de produção |
| `npm run preview` | Servir o build localmente |
| `npm run share` | Sync + build + preview + watcher |
| `npm run sync` | Sincronizar canais cliente-* manualmente |
| `npm run sync:sql` | Sincronizar canal de demandas técnicas |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir |
| `npm test` | Vitest run |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Tests + coverage report |
| `npm run validate` | Lint + typecheck + test (pré-push) |

## Acesso inicial

Após o primeiro `npm run dev`, acesse `http://localhost:8080` e entre com:

- **Login:** `master`
- **Senha:** `Admin@1`

O sistema vai exigir troca de senha imediata.

## Estrutura do projeto

```
src/
├── pages/         Telas (Dashboard, Demandas, SQL, Usuários, Grupos...)
├── components/    Componentes reutilizáveis
├── contexts/      Auth, Theme, Language
├── hooks/         Hooks customizados (usePermissions, etc)
├── lib/           Lógica de negócio (SLA, sync, i18n, storage)
├── data/          Dados sincronizados (gitignored)
├── types/         Tipos TypeScript
└── config/        Temas e branding

scripts/
├── syncSlack.cjs       Sync dos canais cliente-*
├── syncSqlChannel.cjs  Sync do canal técnico
├── stateSync.mjs       Plugin Vite para estado compartilhado
└── ...
```

## Configuração do Slack

O arquivo `.env` precisa de:

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_WORKSPACE=seu-workspace
TEAM_MEMBERS=["Nome Completo do Membro 1","Nome Completo do Membro 2"]
```

`TEAM_MEMBERS` é a lista de usuários internos. Mensagens de quem está
nesta lista são tratadas como "equipe"; o restante é tratado como cliente
externo.

## 🛡 Qualidade e CI

Repositório com pipeline robusto:

- **CI paralelo**: Lint + Typecheck + Build + Test em jobs separados
- **Branch protection** na `main`: 5 status checks obrigatórios, sem bypass
- **Pre-commit hook** (Husky + lint-staged): roda eslint --fix nos arquivos staged
- **Commit-msg hook** (commitlint): força [Conventional Commits](https://www.conventionalcommits.org/)
- **Secrets scan** (Gitleaks): bloqueia PR com token vazado
- **Coverage threshold** em CI (regression-only mode)
- **Bundle size check**: PR mostra delta de tamanho do bundle
- **Lighthouse CI**: score de perf/a11y/SEO/best-practices em PRs
- **Dependabot** + auto-merge de patches/minors
- **Release Please**: changelog + tags semânticas automáticos
- **Stale bot**: fecha PRs/issues abandonados
- **CODEOWNERS** + auto-labeler + size labels (XS/S/M/L/XL)

Veja [`.github/`](.github) pra detalhes.

## Privacidade

Este repositório contém **apenas código**. Os dados sincronizados
(demandas, usuários, históricos, tokens, nomes de funcionários e clientes)
são gerados localmente e estão excluídos do Git via `.gitignore`.

## Licença

[MIT](LICENSE) — código livre pra estudo, fork, adaptação. Os dados sincronizados
da operação real (demandas, usuários, históricos) ficam fora do repo via `.gitignore`.
