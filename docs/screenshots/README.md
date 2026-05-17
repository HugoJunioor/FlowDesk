# Screenshots pendentes

Lista de prints que precisam ser capturados e salvos nesta pasta.
Prints existentes estao marcados como prontos.

## Prontos

- [x] `dashboard-light.png` — dashboard executivo, tema claro
- [x] `dashboard-dark.png` — dashboard executivo, tema escuro
- [x] `kanban.png` — gestao de demandas em kanban
- [x] `ai-classification.png` — classificacao automatica por IA
- [x] `bi-report.png` — relatorio BI interativo
- [x] `permissions-overview.png` — grupos e permissoes (visao geral)
- [x] `permissions-matrix.png` — matriz de permissoes
- [x] `login.png` — tela de login

## Pendentes de captura

- [ ] `onboarding.png`
  - Onde: logar como master com dashboard vazio (nenhuma demanda carregada)
  - O que mostrar: wizard em tela cheia, preferencialmente no passo 2 ou 3
  - Resolucao sugerida: 1440x900

- [ ] `presentation-mode.png`
  - Onde: qualquer tela com modo apresentacao ativo (botao no sidebar)
  - O que mostrar: fullscreen com fonte ampliada, ideal com o dashboard aberto
  - Resolucao sugerida: 1920x1080 (simula TV)

- [ ] `advanced-filters.png`
  - Onde: /demandas-v2 com o sheet lateral de filtros aberto
  - O que mostrar: todos os filtros visiveis (cliente, prioridade, periodo, responsavel, status)
  - Resolucao sugerida: 1440x900

- [ ] `audit-diff.png`
  - Onde: /auditoria, apos clicar em um registro com campo alterado
  - O que mostrar: diff visual antes/depois campo a campo (modo padrao, nao JSON bruto)
  - Dica: editar uma demanda antes pra garantir registro rico no log

- [ ] `audit-diff-json.png`
  - Onde: mesmo registro do audit-diff.png, mas com toggle "JSON bruto" ativado
  - O que mostrar: payload completo antes/depois em JSON side-by-side

- [ ] `api-status.png`
  - Onde: /status (rota da UI) ou acessar GET /api/v1/health/detailed no browser/Insomnia
  - O que mostrar: todos os checks visiveis (DB, disco, memoria) com status OK
  - Dica: usar Insomnia ou devtools Network pra capturar resposta JSON formatada

- [ ] `desktop-notifications.png`
  - Onde: sidebar com o botao "Ativar notificacoes" visivel
  - O que mostrar: botao em destaque, preferencialmente com o dialogo de permissao do browser aparecendo
  - Resolucao sugerida: 1440x900

- [ ] `sync-manual.png`
  - Onde: header do dashboard (/index ou /)
  - O que mostrar: botao "Sincronizar agora" (ou icone de sync) visivelmente destacado
  - Dica: capturar logo apos clicar pra mostrar o estado de loading se possivel

## Como capturar

1. Abrir o FlowDesk local: `npm run dev`
2. Fazer login com `master` / `Admin@1`
3. Navegar ate a tela descrita
4. Capturar com a ferramenta de screenshot do SO (Win+Shift+S no Windows)
5. Salvar nesta pasta com o nome exato listado acima (sem espacos, extensao .png)
6. Commitar: `git add docs/screenshots && git commit -m "docs: adiciona screenshots pendentes"`
