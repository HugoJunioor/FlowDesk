# Roteiro de demonstracao — FlowDesk

Duracao estimada: **7-9 minutos**. Roteiro para apresentacao ao supervisor
antes do go-live on-prem. Cada etapa tem uma acao concreta, uma fala
sugerida e a referencia de screenshot esperada.

---

## 1. Setup (30s)

**Acao:**
```bash
npm run dev:web
# Aguarda "Local: http://localhost:8080"
# Abre o navegador em http://localhost:8080
```
Na tela de login, preenche usuario `master` e senha `Admin@1`.

**Fala:**
"O sistema sobe com um unico comando. Em producao isso roda como servico
systemd — sem nenhuma intervencao manual na inicializacao."

**Screenshot:** `docs/screenshots/login.png`

---

## 2. Dashboard executivo (1min)

**Acao:**
1. Observar os cartoes de metricas no topo: total de demandas, abertas,
   em andamento, resolvidas, P1/P2/P3, SLA em risco.
2. Apontar o grafico de SLA por cliente e o grafico anual mes a mes.
3. Abrir o seletor de filtros: clicar em "Cliente", "Periodo",
   "Responsavel" e "Prioridade" — mostrar que os graficos atualizam.
4. Apontar o indicador de sincronizacao no header ("Sync: ha X minutos").

**Fala:**
"Aqui esta a visao executiva: quantas demandas abertas, quantas em risco
de SLA, distribuicao por cliente. Os filtros sao combinaveis — posso
isolar um cliente especifico num periodo e ver so os P1s do Ana Silva,
por exemplo. O painel se atualiza sozinho a cada 5 minutos sincronizando
com o Slack, sem que ninguem precise apertar nada."

**Screenshot:** `docs/screenshots/dashboard-light.png`

---

## 3. Kanban de demandas (1min)

**Acao:**
1. Clicar em "Demandas" na sidebar.
2. Alternar para a visao Kanban (botao de grade).
3. Mostrar as colunas: Aberta, Em andamento, Aguardando cliente, Resolvida.
4. Clicar em um card para abrir o `DemandaDetalheSheet` lateral.
5. Dentro do sheet: mostrar a thread do Slack, digitar uma resposta no
   campo de texto e apontar o botao "Enviar para o Slack".

**Fala:**
"O Kanban organiza as demandas pelo status atual. Clicar num card abre
o historico completo da thread do Slack aqui dentro — o atendente
responde diretamente nessa tela e a mensagem vai para o canal do Slack
sem precisar sair do sistema."

**Screenshot:** `docs/screenshots/kanban.png`

---

## 4. Classificacao por IA (1min)

**Acao:**
1. No sheet de uma demanda, mostrar o campo "Prioridade sugerida pela IA".
2. Expandir o painel de classificacao: exibir o badge de confianca
   (ex.: `P2 — 87% confidence`) e o campo `reasoning` com a justificativa
   em texto.
3. Mostrar que o operador pode aceitar ou sobrescrever a sugestao.

**Fala:**
"Toda demanda que entra passa pelo classificador automatico. Ele sugere
a prioridade com um percentual de confianca e mostra o raciocinio —
auditavel, nao e caixa-preta. O operador pode aceitar ou mudar, e
qualquer override fica registrado na auditoria."

**Screenshot:** `docs/screenshots/ai-classification.png`

---

## 5. Relatorio BI (1min)

**Acao:**
1. Clicar em "Relatorios" na sidebar (ou icone de grafico no header).
2. Clicar em "Gerar Relatorio BI".
3. O navegador abre (ou faz download de) um HTML autocontido.
4. Mostrar: grafico anual mes a mes, breakdown por cliente, por prioridade,
   por canal.
5. Voltar ao FlowDesk e mostrar o botao "Exportar Excel".

**Fala:**
"O relatorio BI gera um HTML autocontido — pode ser salvo, enviado por
e-mail ou aberto sem conexao. Ele tem graficos interativos de performance
anual, breakdown por cliente e por prioridade. Ha tambem a exportacao em
Excel formatado para quem prefere planilha."

**Screenshot:** `docs/screenshots/bi-report.png`

---

## 6. Modo apresentacao (30s)

**Acao:**
1. No Dashboard, clicar no botao "Modo Apresentacao" (icone de tela cheia
   ou opcao no menu do painel).
2. O dashboard entra em fullscreen e comeca a rotacionar as metricas
   automaticamente com auto-refresh.
3. Pressionar `Esc` para sair.

**Fala:**
"O modo apresentacao coloca o dashboard em tela cheia com auto-refresh.
Util para uma TV na sala da equipe ou para mostrar em reuniao de
diretoria sem precisar mexer no teclado."

**Screenshot:** `docs/screenshots/dashboard-bi-arrow.png`

---

## 7. Auditoria LGPD (1min)

**Acao:**
1. Clicar em "Auditoria" na sidebar (rota `/auditoria`).
2. Mostrar a tabela de eventos: usuario, acao, recurso, IP, timestamp.
3. Usar o filtro por usuario e por periodo.
4. Expandir um evento para mostrar o diff visual (antes/depois de uma
   edicao de demanda).
5. Clicar em "Exportar CSV".

**Fala:**
"Toda mutacao no sistema — criar, editar, deletar demanda, trocar
prioridade, login, logout — e registrada automaticamente com usuario,
IP e timestamp. O diff visual mostra exatamente o que mudou. O export
CSV atende a qualquer auditoria ou solicitacao LGPD."

**Screenshot:** nenhum existente — gravar durante a demo ao vivo.

---

## 8. Permissoes e grupos (1min)

**Acao:**
1. Clicar em "Configuracoes" > "Usuarios".
2. Clicar em "Novo usuario" e preencher nome, e-mail e role.
3. Ir em "Grupos" > mostrar a matriz de 8 modulos (Dashboard, Demandas,
   Infra, Relatorios, Notas, Configuracoes, Auditoria, Usuarios) x 5
   acoes (Ver, Criar, Editar, Deletar, Exportar).
4. Mostrar que ao atribuir um usuario a dois grupos, as permissoes se
   unem automaticamente (uniao de conjuntos).

**Fala:**
"A gestao de acesso e granular: cada grupo define o que pode fazer em
cada modulo. Um usuario em dois grupos herda a uniao das permissoes —
nunca a intersecao. O master e o unico com acesso total por padrao."

**Screenshots:** `docs/screenshots/permissions-overview.png` e
`docs/screenshots/permissions-matrix.png`

---

## 9. Saude do sistema (30s)

**Acao:**
1. Abrir em nova aba: `http://localhost:8080/status` (ou a rota `/status`
   na sidebar BETA).
2. Mostrar o status da API, latencia do banco, uso de disco, uso de memoria.
3. Abrir `http://localhost:4000/api/v1/health/detailed` no terminal ou
   navegador.

**Fala:**
"A pagina de saude mostra em tempo real se a API esta respondendo, a
latencia do banco e o consumo de recursos. Isso e o que o monitoramento
externo vai checar a cada 30 segundos em producao."

**Screenshot:** nenhum existente — gravar durante a demo ao vivo.

---

## 10. Backup e sync manual (30s)

**Acao:**
1. No terminal, rodar:
   ```bash
   npm run backup
   ```
   Mostrar a saida confirmando o arquivo em `/var/backups/flowdesk/`.
2. Voltar ao navegador, clicar no botao "Sincronizar agora" no header do
   Dashboard.
3. Mostrar o indicador de sync atualizando.

**Fala:**
"O backup roda automaticamente toda noite as 2h e retem 30 dias. O
operador tambem pode disparar manualmente — util antes de uma atualizacao.
O sync manual forca a busca de novas mensagens do Slack sem esperar o
ciclo de 5 minutos."

**Screenshot:** `docs/screenshots/dashboard-light.png` (header com botao sync visivel)

---

## FAQ — Perguntas previsiveis do supervisor

### "Quanto tempo levaria para adicionar um cliente novo?"

Menos de 5 minutos. Clientes sao identificados automaticamente pelo nome
do solicitante que chega via Slack — nao ha cadastro previo obrigatorio.
Se quiser um canal dedicado para o cliente, basta adicionar o nome do
canal Slack no `.env` (`SLACK_CHANNELS`) e rodar a sincronizacao. O
cliente aparece nos filtros e no dashboard na proxima sincronizacao.

### "Como funciona o failover se o Slack cair?"

O FlowDesk continua operacional com os dados ja sincronizados. Os
operadores conseguem consultar demandas abertas, editar prioridades,
adicionar notas internas e gerar relatorios normalmente. O que nao
funciona sem o Slack e enviar respostas para as threads e receber
demandas novas. Quando o Slack voltar, a proxima sincronizacao (automatica
ou manual) traz tudo que ficou pendente. Nao ha perda de dados locais.

### "Onde ficam os dados em producao?"

Tudo on-prem, no servidor da propria Just. Os arquivos de dados ficam em
`/opt/flowdesk/app/data/` — JSON files com escrita atomica. Nenhum dado
de demanda, usuario ou historico sai do servidor. A unica comunicacao
externa e com a API do Slack (para ler e escrever mensagens) e,
opcionalmente, com o Resend para envio de e-mail de notificacao interna.

### "Como auditar quem mudou o que?"

Todo `POST`, `PUT`, `PATCH` e `DELETE` passa por um middleware automatico
que registra em `tb_auditoria`: id do usuario, acao, recurso afetado, IP
de origem, user-agent, request_id e timestamp. Eventos criticos como
login, logout e troca de senha sao registrados explicitamente. Senhas e
tokens aparecem sempre como `[REDACTED]`. A pagina `/auditoria` expoe
esses registros com filtro por usuario e periodo, diff visual e export CSV.

### "LGPD: como apagamos dados de um cliente?" (right to be forgotten)

O procedimento esta documentado em `docs/LGPD.md`, secao 7.3. Em resumo:

1. Fazer backup pre-erasing:
   ```bash
   tar czf /var/backups/flowdesk/pre-erase-$(date +%Y%m%d).tar.gz \
     /opt/flowdesk/app/data/
   ```
2. Rodar o script de erasing (ou editar o JSON manualmente enquanto o
   script dedicado nao existe):
   ```bash
   node scripts/erase-user-data.cjs --name "Nome Completo do Cliente"
   ```
3. Reiniciar o servico e confirmar que os dados sumiram.

Todo o processo fica registrado na auditoria (quem executou, quando).
O prazo legal para responder a solicitacao de exclusao e 15 dias uteis
conforme a LGPD.

---

## Dicas para o apresentador

- Usar o tema escuro para melhor contraste em projetor
  (Configuracoes > Tema > Dark).
- Desativar notificacoes do sistema operacional antes de comecar.
- Manter o terminal aberto em split ao lado do navegador para os comandos
  de backup e sync.
- Se o Slack nao estiver configurado no ambiente de demo, os dados
  mostrados serao os dados de seed local — validos para demonstrar todas
  as funcionalidades da UI.
- Atalhos de teclado uteis durante a demo:
  - `?` ou `Shift+?` — abre o painel de atalhos do FlowDesk
  - `Ctrl+K` — busca rapida de demandas
  - `Esc` — fecha sheets e modais

---

*Documento criado em 2026-05-17. Revisar antes de cada apresentacao.*
