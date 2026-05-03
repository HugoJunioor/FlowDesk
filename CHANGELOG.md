# Changelog

Todas as mudanças relevantes deste projeto seguem o formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
- Camada de adapters multi-canal (`src/adapters/`) com contrato
  `DemandAdapter` e stub de Microsoft Teams
- Modo demo (`VITE_DEMO_MODE`) com banner de credenciais visíveis
- `.npmrc` com `legacy-peer-deps=true` (compatibilidade Vercel)
- `vercel.json` com SPA rewrites + headers de segurança

### Alterado
- README expandido com diagrama Mermaid de arquitetura, seção
  multi-canal, screenshots e badges (CI, demo, license)
- Meta de SLA padrão de 90% para 80%
- Demandas sem prioridade explícita ("conciliação", "remessa SITEF",
  etc) viram P3 automaticamente

### Corrigido
- Variáveis `slaResOk` / `slaResBreach` indefinidas no
  `reportGenerator.ts` (relatório BI quebrado)
- Toast de erro no `ReportButton` (antes silenciava falhas)

### Segurança
- PBKDF2 (150k iterações + salt) substituindo SHA-256
- HTTPS self-signed via `@vitejs/plugin-basic-ssl`
- Auth token obrigatório em endpoints internos (`/__state`, `/__sync-sql`)
- CORS restrito a ranges privados (loopback + RFC1918 + Tailscale)
- Rate limit no login (5 tentativas / 5 min)
- Bloqueio de senhas fracas comuns + exigência de senha forte
- Backup rotativo do estado compartilhado + escrita atômica
- Headers de segurança no preview (HSTS, CSP, X-Frame-Options)

## [1.0.0] - 2026-04-15

### Adicionado
- Dashboard executivo com métricas, gráficos por prioridade/cliente
  e visão anual mês a mês
- Gestão de demandas em lista, kanban, com agrupamentos
- Sincronização automática com Slack a cada 5 minutos
- SLA em horas úteis (Seg-Sex 8-18, descontando feriados nacionais
  e municipais Campinas/SP)
- Módulo isolado para demandas SQL/técnicas
- Grupos e permissões granulares (8 módulos × 5 ações)
- Multi-idioma: PT-BR, EN-US, ES-ES por usuário
- 16 temas de cores com modo claro/escuro
- Relatórios BI (HTML interativo) e Excel formatado
- Autenticação por usuário com sessão de 8h e troca obrigatória
  no primeiro acesso
- Estado compartilhado entre dispositivos via VPN/rede mesh

[Unreleased]: https://github.com/HugoJunioor/FlowDesk/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/HugoJunioor/FlowDesk/releases/tag/v1.0.0
