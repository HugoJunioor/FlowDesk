# Export pra planilha Suporte → Engenharia

A cada execução do sync do Slack (cron de 5 min), o FlowDesk envia os chamados
do formulário **"Novo chamado"** para a aba `Demandas` da planilha de gestão
Suporte → Engenharia no Google Sheets.

- O FlowDesk **cria** a linha quando o chamado aparece e **mantém atualizadas**
  as colunas que vêm dele.
- A Engenharia **completa** as colunas dela. O sync nunca as sobrescreve.
- Nenhuma linha é apagada. Linhas criadas à mão (WhatsApp, ClickUp, etc.)
  nunca são tocadas.

```
cron */5 ─▶ syncSlack.cjs ─▶ realDemands.ts
              └─▶ syncSheets.ts ── POST {token, rows} ─▶ Apps Script (doPost) ─▶ aba Demandas
```

| Peça | Arquivo |
|------|---------|
| Exportador (servidor) | `apps/web/scripts/syncSheets.ts` |
| Conversão demanda → linha | `apps/web/src/lib/sheetsExport.ts` |
| Apps Script (roda na planilha) | `apps/web/scripts/sheets/flowdeskSheetSync.cjs` |
| Chamada no cron | `scripts/sync-slack-cron.sh` |

O exportador roda o mesmo pipeline da tela (`src/data/demandsPipeline.ts`).
Assim, prioridade, status e overrides na planilha são exatamente os que o
FlowDesk mostra.

---

## Quem é dono de cada coluna

| Coluna | Dono | Regra |
|--------|------|-------|
| A ID | FlowDesk | Protocolo do formulário (id do FlowDesk se faltar). É a chave da linha. |
| B Abertura/data | FlowDesk | Data de abertura no Slack. |
| C Cliente | FlowDesk | `Cliente/Organização` do formulário. |
| D Solicitante Suporte | FlowDesk | "Aberto via formulário por …" |
| E Canal | FlowDesk | Sempre `Slack`. |
| F Tipo | FlowDesk | Natureza do formulário, veja o mapeamento abaixo. |
| G Criticidade | FlowDesk | Prioridade atual no FlowDesk (P1 Crítica · P2 Alta · P3 Média). |
| H Problema / Demanda | FlowDesk | Título, resultado obtido/esperado, impacto, ambiente e IDs técnicos. |
| I Testes realizados pelo Suporte | FlowDesk | "O que tentou fazer". |
| J Evidências / Links | FlowDesk | Link da thread, link do ClickUp, quantidade de anexos. |
| K Time atual | Engenharia | — |
| L Responsável Engenharia | Engenharia | — |
| M Status | Compartilhado | O FlowDesk grava `Nova` ao criar e `Concluída` quando a demanda fecha. No meio, vale o que a Engenharia puser. `Concluída` e `Cancelada` definidas pela Engenharia nunca são sobrescritas. |
| N SLA (h) | FlowDesk | 4 / 8 / 24, conforme a criticidade. |
| O Prazo SLA | FlowDesk | Prazo em **horas úteis** (seg–sex 8h–18h, feriados), a mesma regra do dashboard. Substitui a fórmula de horas corridas nas linhas do FlowDesk. |
| P Previsão ao Cliente | Engenharia | — |
| Q, R, S | Fórmulas | Calculadas pela planilha a partir de O e T. O sync não mexe. |
| T Data conclusão | FlowDesk, quando houver | Só é escrita quando o FlowDesk tem uma conclusão; nunca apaga uma data preenchida à mão. |
| U Retorno / Solução Engenharia | Engenharia | — |
| V Próxima ação | Engenharia | — |
| W Última atualização | Compartilhado | Só avança: o FlowDesk grava a última atividade da thread se ela for mais recente que o valor atual. |
| X Observações | Engenharia | — |

Mapeamento do Tipo: `Problema` → **Bug**, `Ajuda` → **Dúvida técnica**, `Update`
→ **Melhoria**, `Remessa` → **Dados/Relatório**, resto → **Outro**. Como F é
do FlowDesk, um ajuste feito na planilha volta ao valor mapeado no sync
seguinte.

O CNPJ do formulário **não** é enviado: o ID da organização e o Cliente já
identificam a empresa (minimização de dados).

---

## Instalação (uma vez)

### 1. Planilha

1. **Compartilhamento:** restrinja o acesso ao domínio da empresa (Compartilhar
   → Acesso geral → *Restrito* ou só o domínio). A planilha passa a receber
   dados de clientes; não pode ficar como "qualquer pessoa com o link".
2. **Fuso:** Arquivo → Configurações → Fuso horário = *(GMT-03:00) São Paulo*.

### 2. Apps Script

1. Na planilha: **Extensões → Apps Script**.
2. **Não apague** o que já existir no projeto. Clique em **+ → Script**, dê o
   nome `FlowDeskSync` e cole o conteúdo inteiro de
   `apps/web/scripts/sheets/flowdeskSheetSync.cjs`.
3. **Configurações do projeto** (engrenagem):
   - Fuso horário: *(GMT-03:00) São Paulo*.
   - **Propriedades do script** → adicionar `FLOWDESK_TOKEN` com um segredo
     novo. Para gerar: `openssl rand -hex 32`.
4. **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa** (o servidor não tem login Google;
     quem protege é o `FLOWDESK_TOKEN`)
5. Autorize o acesso à planilha e copie a URL que termina em `/exec`.

> Se o Workspace bloquear "Qualquer pessoa", o servidor recebe uma página HTML
> em vez de JSON e o log mostra `resposta nao-JSON do Apps Script`. Nesse caso
> é preciso liberar App da Web externo no admin do Workspace.

### 3. Servidor

Adicione ao `.env` da raiz (`/opt/flowdesk/app/.env`), o mesmo que o cron repassa
ao container:

```env
SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/<id-da-implantacao>/exec
SHEETS_WEBHOOK_TOKEN=<mesmo valor do FLOWDESK_TOKEN>
```

Sem aspas: o `docker run --env-file` do cron as repassaria literalmente. O
exportador remove aspas por segurança, mas outras variáveis do mesmo arquivo
não têm essa proteção.

Não há rebuild: `apps/web/scripts/**` e `scripts/*.sh` rodam do bind mount.
Depois do `git reset --hard origin/main`, o próximo ciclo do cron já exporta.

### 4. Conferir

Dry-run, que mostra os 3 últimos chamados que seriam enviados e não envia nada:

```bash
docker run --rm -v /opt/flowdesk/app:/app -w /app/apps/web \
  --env-file /opt/flowdesk/app/.env node:20-alpine \
  node --import tsx scripts/syncSheets.ts --dry-run
```

Depois do próximo ciclo do cron:

```bash
grep '\[planilha\]' /var/log/flowdesk-sync.log | tail -5
```

---

## Operação

| Linha no log | Significado |
|--------------|-------------|
| `desativado (SHEETS_WEBHOOK_URL/…)` | Variáveis ausentes, o export está desligado. |
| `enviado: N nova(s), M atualizada(s), K sem mudanca` | Ciclo normal. |
| `sem mudancas desde o ultimo envio` | Nada mudou. Mesmo assim, reenvia de hora em hora para recriar linha apagada por engano. |
| `Apps Script recusou … token_invalido` | `SHEETS_WEBHOOK_TOKEN` diferente de `FLOWDESK_TOKEN`. |
| `Apps Script recusou … cabecalho mudou na coluna X` | Alguém moveu, inseriu ou renomeou coluna. O sync recusa para não gravar dado na coluna errada; volte o cabeçalho ou atualize `FD_HEADERS` no script. |
| `resposta nao-JSON do Apps Script` | URL errada ou implantação sem acesso "Qualquer pessoa". |
| `tsx ausente em node_modules` | Rode `npm ci` no servidor: o exportador é TypeScript. |

- **Forçar reenvio completo:** apague `apps/web/data/sheets-export-state.json`.
- **Atualizar o Apps Script:** depois de colar a versão nova, vá em *Implantar →
  Gerenciar implantações → editar → Nova versão*. Só salvar o código não muda o
  App da Web publicado. Editar a implantação mantém a mesma URL.
- **Trocar o token:** altere `FLOWDESK_TOKEN` no script e `SHEETS_WEBHOOK_TOKEN`
  no `.env`. O próximo ciclo reenvia sozinho, porque o destino entra no hash.

## Limitações conhecidas

- O Dashboard da planilha conta `Demandas!A2:A500`. Passando de ~500 linhas,
  as fórmulas dele precisam ser estendidas.
- Texto enviado é gravado como texto literal (prefixo `'`): nada vindo do
  formulário vira fórmula ou é convertido em data.
- Só entram chamados do formulário "Novo chamado". Formulários antigos,
  Sitef/Conciliação e Demandas Internas ficam de fora.
