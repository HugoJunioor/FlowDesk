# Changelog

Todas as mudanças relevantes deste projeto seguem o formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento [SemVer](https://semver.org/lang/pt-BR/).

## 1.0.0 (2026-05-12)


### Features

* 3 graficos mensais no dashboard (modo Anual) ([9c47f0b](https://github.com/HugoJunioor/FlowDesk/commit/9c47f0b04449a284fc403833a58e16edc6c329f7))
* 6 novos temas (Neon, Aurora, Midnight, Coral, Menta, Cereja) + sidebar traduzida ([c328738](https://github.com/HugoJunioor/FlowDesk/commit/c328738e7abb3c33afb6a57765c79e6ef21271f5))
* adicionar categoria + reacao check como conclusao + melhorias ([e1696c5](https://github.com/HugoJunioor/FlowDesk/commit/e1696c5275740d21f152be1553482bc165119677))
* adicionar novo responsavel com persistencia localStorage ([84d0204](https://github.com/HugoJunioor/FlowDesk/commit/84d020436132228a565278c203d399bffc9beba1))
* adicionar watcher de sync do slack a cada 5 minutos ([ef692b4](https://github.com/HugoJunioor/FlowDesk/commit/ef692b4239a68ae8435626e8f30ee09e642f0ee1))
* **ai:** classifica motivo de contato baseado em 158 demandas de abril ([#16](https://github.com/HugoJunioor/FlowDesk/issues/16)) ([4c32bf0](https://github.com/HugoJunioor/FlowDesk/commit/4c32bf06a76c5d99d4d020c6c9c4cca63e9a556d))
* analise automatica de status de 48 demandas reais ([9f0c0c3](https://github.com/HugoJunioor/FlowDesk/commit/9f0c0c371bb6e78b242bcddc85f8cb54a74adbed))
* analise contextual de conversa + encaminhamento como resolucao ([a5829a6](https://github.com/HugoJunioor/FlowDesk/commit/a5829a6a4daa986be3350479b8e495a8c5b03ab6))
* apenas circulo verde fecha novas demandas ([e45dda4](https://github.com/HugoJunioor/FlowDesk/commit/e45dda4f91862c3772b1c648048b1bb77dae7467))
* **api:** apps/api skeleton seguindo padrao Just (Fase 1A) ([#35](https://github.com/HugoJunioor/FlowDesk/issues/35)) ([e1dbf47](https://github.com/HugoJunioor/FlowDesk/commit/e1dbf47318fcf3093a8b07aa25aae137c3643e6e))
* atualizar prioridades para SLA real (P1/P2/P3) ([f9c2cf2](https://github.com/HugoJunioor/FlowDesk/commit/f9c2cf2f0992c3882b8956cb2ad12f519672d277))
* badge piscante de inatividade (&gt;24h) nos cards e lista ([9d123e5](https://github.com/HugoJunioor/FlowDesk/commit/9d123e5bbb6a437c83eef826baecbcaa1e72dcb9))
* botao Atualizar do SQL faz sync + rebuild + reload automatico ([24aecff](https://github.com/HugoJunioor/FlowDesk/commit/24aecff2656b0d66934b1aeb40483b7134b76f65))
* cadastro de motivos de expiracao + edicao da task associada ([cb23240](https://github.com/HugoJunioor/FlowDesk/commit/cb23240bc3bf9915b72b64a85ff4829f3a168f0d))
* camada de adapters multi-canal + diagrama de arquitetura ([7fa4d9b](https://github.com/HugoJunioor/FlowDesk/commit/7fa4d9b443a0d50fd85880438aeabf8918797d4c))
* campos de fechamento com IA + filtros + regras automaticas ([98b6eb1](https://github.com/HugoJunioor/FlowDesk/commit/98b6eb1d94c9851fef2b6e8e9a95d831a32700c1))
* centralizar processamento de demandas + filtro responsavel na dashboard ([6bfa76c](https://github.com/HugoJunioor/FlowDesk/commit/6bfa76cdb37e6333ea9256b0b0c31404226f7ed3))
* **channel-routing:** deteccao automatica de canais novos + bulk actions ([feb767d](https://github.com/HugoJunioor/FlowDesk/commit/feb767d4c916dba73a44ee97ac6da7c845ed6018))
* classificador automatico de prioridade + troca de prioridade ([fffd671](https://github.com/HugoJunioor/FlowDesk/commit/fffd671a0b7629a874ecce481912e43bfbb234c2))
* **composer:** toolbar completo paridade com Slack (rich formatting) ([a4511e9](https://github.com/HugoJunioor/FlowDesk/commit/a4511e9e2b06da76430b457c23711c99b04a67c1))
* conclusao com data/hora manual + flag SLA estourado ([53bb8bc](https://github.com/HugoJunioor/FlowDesk/commit/53bb8bc0fa638d480362f1fb56f75b7d255226d1))
* configurar dev server para acesso remoto via VPN/LAN ([3e1ba8f](https://github.com/HugoJunioor/FlowDesk/commit/3e1ba8f870ea622b5f87553b0e04d2fbe35a75d9))
* dados reais dos workflows Slack + novos campos ([d2384c0](https://github.com/HugoJunioor/FlowDesk/commit/d2384c01c8ef729d1c747ceadd92a94491aca7df))
* dashboard analitica, SLA corrigido, responsividade mobile ([d47fa93](https://github.com/HugoJunioor/FlowDesk/commit/d47fa93b0fcc01a960c31d9b5c65600de2b72479))
* **demand-detail:** trocar Sheet lateral por Dialog central + composer stub ([dc78a16](https://github.com/HugoJunioor/FlowDesk/commit/dc78a167ddd128863e949f258c26b7f08aae0659))
* estado compartilhado entre origens (localhost e VPN) ([fd271c4](https://github.com/HugoJunioor/FlowDesk/commit/fd271c47cd9b20a511a40909a34967e2faf23164))
* **excel:** adiciona coluna Motivo de Contato classificado por IA ([#18](https://github.com/HugoJunioor/FlowDesk/issues/18)) ([da95224](https://github.com/HugoJunioor/FlowDesk/commit/da95224cdcbd0b08536fb12fa66bb3903537b23e))
* filtro por data e cliente, stats clicaveis ([65fa430](https://github.com/HugoJunioor/FlowDesk/commit/65fa430f28515e1ab3f34b22febbf1dca4020374))
* filtro SLA, tema claro relatorios, anexos, observacao de conclusao e melhorias ([c9a8154](https://github.com/HugoJunioor/FlowDesk/commit/c9a81540583aa7861109dedf1f9c8b1a77fa04d4))
* filtros de periodo (hoje/semanal/mensal) + calendario shadcn ([aa18129](https://github.com/HugoJunioor/FlowDesk/commit/aa1812958058d7000935c1bd83bc469bd7802eda))
* filtros locais nos graficos + sidebar logo clicavel ([e592110](https://github.com/HugoJunioor/FlowDesk/commit/e592110f9783f0332d757ed005d9918c642100da))
* forcar tema claro na tela de login + rodape powered by ([a5e85da](https://github.com/HugoJunioor/FlowDesk/commit/a5e85da8d5992638bf9c8489e1b20dc30e1189ed))
* gerenciamento de Grupos de Demandas (roteamento canais Slack) ([0adb387](https://github.com/HugoJunioor/FlowDesk/commit/0adb387b86527bf6c4f44ae54cf9a6e0a52a8135))
* horas uteis no SLA e troca de responsavel ([13c90ac](https://github.com/HugoJunioor/FlowDesk/commit/13c90aca4c3fdc330959c80c7347c39b8c4d17c6))
* idioma por usuario, aparencia compacta, feriados perenes ([fde3e55](https://github.com/HugoJunioor/FlowDesk/commit/fde3e55687a0826105c916438deb7f0df2c84fe6))
* **infra:** detalhe da demanda em sheet + tabs por status (incl. Em atraso) ([#22](https://github.com/HugoJunioor/FlowDesk/issues/22)) ([5dbb57a](https://github.com/HugoJunioor/FlowDesk/commit/5dbb57a5bf7487844a2503011265a3f6a91a0426))
* **infra:** novo modulo de demandas internas (SQL + Deploy) ([#20](https://github.com/HugoJunioor/FlowDesk/issues/20)) ([86332d5](https://github.com/HugoJunioor/FlowDesk/commit/86332d54d40b173dff23834a0901cefc48b4ff83))
* **infra:** quadros KPI por status + filtros SQL/Deploy ([#26](https://github.com/HugoJunioor/FlowDesk/issues/26)) ([31ed48f](https://github.com/HugoJunioor/FlowDesk/commit/31ed48fec5402f9e4ca9e8851f1d70bfe9a78499))
* **infra:** SQL usa dropdown de Tipo de Execucao em vez de titulo livre ([#21](https://github.com/HugoJunioor/FlowDesk/issues/21)) ([6d9c22e](https://github.com/HugoJunioor/FlowDesk/commit/6d9c22e8f65b21d346a8e03457615ea73d2fd6dc))
* legenda + subtitulos + linha meta 90% nos graficos mensais ([eacd490](https://github.com/HugoJunioor/FlowDesk/commit/eacd49033736c859e6c8c51f429fb5d3394ded99))
* **local:** endpoints /slack/* no Vite dev server (dispensa Railway) ([2f67356](https://github.com/HugoJunioor/FlowDesk/commit/2f67356ae1e0f08ec1cc3d7683b36103470e9ea7))
* manter motivo da expiracao nos cards de concluidas fora do SLA ([0444b66](https://github.com/HugoJunioor/FlowDesk/commit/0444b66cffd6d9df9a382d1482a088d21ab0ef47))
* **mention:** mascara @&lt;ID&gt; com nome no textarea, expande no envio ([16f3a98](https://github.com/HugoJunioor/FlowDesk/commit/16f3a98c58d5dd28530bc19b4d69d0f1425d1767))
* **mention:** navegacao por teclado (Up/Down/Enter/Esc) + click highlight ([ecd9bd2](https://github.com/HugoJunioor/FlowDesk/commit/ecd9bd2edf3400fe6cb87313365e1636e00c4901))
* meta SLA 80% + novas demandas sem prioridade viram P3 ([a114dbd](https://github.com/HugoJunioor/FlowDesk/commit/a114dbd0d4758c92d589cb57e833caf6cfb408af))
* modo demo + config Vercel para portfolio ([4e68da7](https://github.com/HugoJunioor/FlowDesk/commit/4e68da7c688fdec169800a6fbff5f4f443929cf2))
* modulo de Grupos com permissoes por modulo e acao ([ff816d3](https://github.com/HugoJunioor/FlowDesk/commit/ff816d3ee7ff8440bd6f18aca0bb4198354697a8))
* modulo Demandas Slack com kanban, filtros e countdown ([365d9b6](https://github.com/HugoJunioor/FlowDesk/commit/365d9b62f06052ccb2cb09953255146cb4cba9d2))
* modulo Demandas SQL isolado (canal #operacoes-sql) ([5ffc3be](https://github.com/HugoJunioor/FlowDesk/commit/5ffc3beaf57635467051333dffa087b2427d0598))
* **notes:** bloco de notas pessoal (Kanban + Lista) ([#25](https://github.com/HugoJunioor/FlowDesk/issues/25)) ([6c5d792](https://github.com/HugoJunioor/FlowDesk/commit/6c5d79239a2cf9794609200dd39d0c0a82c56a85))
* **notifications:** inbox de eventos no FlowDesk (sino + página + storage) ([#23](https://github.com/HugoJunioor/FlowDesk/issues/23)) ([4cd28f6](https://github.com/HugoJunioor/FlowDesk/commit/4cd28f6ecea1f2a2883d788c98ad02034a1ae80c))
* **notifications:** lembretes SLA via engine no polling do sino ([#24](https://github.com/HugoJunioor/FlowDesk/issues/24)) ([bdaa871](https://github.com/HugoJunioor/FlowDesk/commit/bdaa8716ab1a70f1ff4e24b4a6709b98982135af))
* persistencia local + separacao dados reais do Git ([c830bec](https://github.com/HugoJunioor/FlowDesk/commit/c830bec1a998cbe012bf7e32db5b59b6e6ce2a84))
* redesign tela de login - fundo azul full, area branca lateral ([e3759c1](https://github.com/HugoJunioor/FlowDesk/commit/e3759c15c40ccb57b8a95553c9da5afa971cc00c))
* relatorio interativo, filtro anual, analise de status no sync e persistencia PostgreSQL ([2e1aec6](https://github.com/HugoJunioor/FlowDesk/commit/2e1aec61b6fb78547f41f3262f330d7f42cb7261))
* **report:** produto detectado por workflow name + exibido no BI/Excel ([#17](https://github.com/HugoJunioor/FlowDesk/issues/17)) ([fefd7ac](https://github.com/HugoJunioor/FlowDesk/commit/fefd7ac63974033e9ffcd9b82dffb1c79d18d565))
* restyling selects com shadcn + SLA primeira resposta e resolucao ([0d08e69](https://github.com/HugoJunioor/FlowDesk/commit/0d08e69af78093667e088f8ca616f7f2c64c5c39))
* script "npm run share" para acesso remoto rapido ([5112545](https://github.com/HugoJunioor/FlowDesk/commit/5112545deab478126f2daf194cfe045cbc68761e))
* script para resetar senha de usuario ([dc66185](https://github.com/HugoJunioor/FlowDesk/commit/dc66185fd55d7e47bad25da890ceabd5a22985a9))
* **security:** hardening pre-prod (PR A — rate limit, CORS env, /health, logs) ([#32](https://github.com/HugoJunioor/FlowDesk/issues/32)) ([acf6955](https://github.com/HugoJunioor/FlowDesk/commit/acf6955b98a31878b4e2d415482c1c4f81aa26e8))
* sincronizacao real com Slack - 55 demandas importadas ([1779977](https://github.com/HugoJunioor/FlowDesk/commit/1779977b3d98ef87c416336765b42161c23d9f9a))
* sistema de 10 temas de cores com modo claro/escuro ([668942b](https://github.com/HugoJunioor/FlowDesk/commit/668942ba87515448dda83328cd06bc58ce06077d))
* sistema de autenticação e gerenciamento de usuários ([1de52ba](https://github.com/HugoJunioor/FlowDesk/commit/1de52ba6719f08e21f37a0f2a1511eba00fbf6ff))
* sistema de branding dinamico + melhorias visuais login e sidebar ([3e8fcaf](https://github.com/HugoJunioor/FlowDesk/commit/3e8fcaffecebe3275ad9481aab653fca263baee5))
* SLA e aprovacao manual no modulo SQL ([b97d62c](https://github.com/HugoJunioor/FlowDesk/commit/b97d62c8e985f0de4a12540a72ae0991fb148445))
* **slack-composer:** polish — emoji picker + mention autocomplete (fase 7) ([9e6f3f1](https://github.com/HugoJunioor/FlowDesk/commit/9e6f3f12b801e34a401b1271ce5b49ac0bc8c993))
* **slack:** composer enviando resposta via flowdesk-api real (fases 3+4) ([cc2118e](https://github.com/HugoJunioor/FlowDesk/commit/cc2118e0d8f68e71f3a32bec7ea554a2b1b89818))
* **slack:** exibir anexos das demandas (imagens + arquivos) no detalhe ([5d8b10d](https://github.com/HugoJunioor/FlowDesk/commit/5d8b10d1ec06c365a9fde737f9e24b168657c3b9))
* **slack:** postar como usuario real + mention real com membros do canal ([336aa11](https://github.com/HugoJunioor/FlowDesk/commit/336aa118c2ceea0407ed2170b32159a626cc4475))
* **slack:** upload de arquivos no composer + drag-drop (fases 5b+6) ([b018e2d](https://github.com/HugoJunioor/FlowDesk/commit/b018e2d55de088bf4950e1fba7cb00f9e7913f8d))
* **sla:** excluir do calculo demandas com atraso por culpa do cliente ([272e1b1](https://github.com/HugoJunioor/FlowDesk/commit/272e1b1fb1e261b36be7b306e8fe7205dc9fded4))
* **sla:** fluxo :loading: pra Sitef/Conciliacao + 1a resposta efetiva ([#15](https://github.com/HugoJunioor/FlowDesk/issues/15)) ([8a1755c](https://github.com/HugoJunioor/FlowDesk/commit/8a1755c94660c068a5c4e87692efe7dbc4742c9b))
* so circulo verde marca como concluida (remover deteccao por texto) ([144ed70](https://github.com/HugoJunioor/FlowDesk/commit/144ed70e2de7587df71d49050ac8d4e5a26cfdb9))
* **sql:** SLA em horario comercial, aprovacao por texto, coluna concluido ([5278ce8](https://github.com/HugoJunioor/FlowDesk/commit/5278ce8eb5597bf5ec28f75a38879db2be3475b9))
* **stale:** badge "sem interacao" no Infra + formato com "e" entre dias/horas ([#30](https://github.com/HugoJunioor/FlowDesk/issues/30)) ([6612287](https://github.com/HugoJunioor/FlowDesk/commit/661228708742a598d7c91ff6ce70f6d972c6833e))
* **sync-sql:** aceitar canais extras via SLACK_OPS_EXTRA_CHANNELS ([39393ec](https://github.com/HugoJunioor/FlowDesk/commit/39393ecd94cc579d8ac10d80c72e937745f99f1d))
* **sync:** description traz corpo completo apos 'Descricao da demanda' ([706f618](https://github.com/HugoJunioor/FlowDesk/commit/706f6188f7e49864d31435b9b62d33709a4787ce))
* **sync:** identifica equipe por dominio de email (auto, sem editar lista) ([#12](https://github.com/HugoJunioor/FlowDesk/issues/12)) ([b559788](https://github.com/HugoJunioor/FlowDesk/commit/b559788043a550137e83106aca6fa0648f0c7d74))
* **sync:** syncSlack.cjs captura files das mensagens e replies ([5411af6](https://github.com/HugoJunioor/FlowDesk/commit/5411af67567494462f74b8190d80afb0a494c80d))
* **theme:** adicionar tema Psicodelico (17o tema) ([1445d18](https://github.com/HugoJunioor/FlowDesk/commit/1445d186296c2629eac1abec46f5f832b93b9168))
* **thread:** edit/delete proprios + reorder + thumbs menores + composer clean ([0468e04](https://github.com/HugoJunioor/FlowDesk/commit/0468e0462adeff5c831f4f0ea4d7aa0ffbc5c957))
* **thread:** optimistic update — resposta aparece na thread imediatamente ([08e795d](https://github.com/HugoJunioor/FlowDesk/commit/08e795d334aa261ef6bf7afd2da629c2c0a5fe1f))
* **thread:** refresh sob demanda + auto-refresh apos envio + click do mention ([b175114](https://github.com/HugoJunioor/FlowDesk/commit/b175114da7adfdafd8fa6409cf30f4fd0a9c8465))
* trocar tema Cereja por Flamengo (rubro-negro) ([e225872](https://github.com/HugoJunioor/FlowDesk/commit/e225872d1b9c8f54f75d0cf492dd83c1beab89f0))
* **types:** novos tipos Sitef/Conciliacao + categorias + P3 default ([#14](https://github.com/HugoJunioor/FlowDesk/issues/14)) ([014cd55](https://github.com/HugoJunioor/FlowDesk/commit/014cd552620984ca6c5cf1ea32ed6ba74d8a1cff))
* verificador automatico de status por analise de respostas ([7d4b98e](https://github.com/HugoJunioor/FlowDesk/commit/7d4b98eb85506762dfd88044f6e8a2a3d3dd747c))
* vincular tema ao perfil do usuario ([9ddafff](https://github.com/HugoJunioor/FlowDesk/commit/9ddafffa506f9ba3e688fb8e76483c246d20e934))
* visualização em lista com agrupamento e filtros melhorados ([9a07d98](https://github.com/HugoJunioor/FlowDesk/commit/9a07d983fad80d2b3d251325036f5ec692af0c2a))


### Bug Fixes

* 'sem interacao 24h' agora desconta fds e feriados (horas uteis) ([e653a6b](https://github.com/HugoJunioor/FlowDesk/commit/e653a6b09ab98f185145854231eb7da791bc582d))
* aceitar nome do canal com ou sem acento (operações-sql) ([cf05b52](https://github.com/HugoJunioor/FlowDesk/commit/cf05b52f02e701abf46c7e30ad81467cba0e2394))
* aceitar white_check_mark e similares como conclusao ([5379051](https://github.com/HugoJunioor/FlowDesk/commit/5379051223a3719d0d479116a44b55ee609112ea))
* blindar filtro sem_interacao contra threadReplies undefined ([a9627a4](https://github.com/HugoJunioor/FlowDesk/commit/a9627a4d4d6288282e26f70892a8528e944ea144))
* botoes de copiar funcionam em contexto nao-seguro (HTTP via IP) ([dc6d90a](https://github.com/HugoJunioor/FlowDesk/commit/dc6d90afc1f1e10c0cb2e055456122927ac1402e))
* cálculo de SLA alinhado com metodologia do relatório mensal ([91f9884](https://github.com/HugoJunioor/FlowDesk/commit/91f9884d33edb8ef65564a2b04c98013961517fa))
* check reaction (🟢) no Slack sobrepoe override manual anterior ([75acb78](https://github.com/HugoJunioor/FlowDesk/commit/75acb788dd3b2177d837e46709536d17917c5bb7))
* classificador agora reclassifica P1/P2/P3 e ignora sem_classificacao ([8a50e4e](https://github.com/HugoJunioor/FlowDesk/commit/8a50e4e9fb3996ac91fb8ae42f987954eb16ae61))
* **composer:** botao enviar dentro do textarea + textarea maior + placeholder limpo ([4bec2b6](https://github.com/HugoJunioor/FlowDesk/commit/4bec2b6bac2b26adcf9124cfe0e3d9af7029f83d))
* **composer:** mention dropdown abre PRA BAIXO + maior (nao corta) ([d1a5c91](https://github.com/HugoJunioor/FlowDesk/commit/d1a5c91d150ecf8c2db84b9e181b3e26d71587a7))
* **composer:** mention dropdown como JANELA FLUTUANTE via Portal ([4d573b9](https://github.com/HugoJunioor/FlowDesk/commit/4d573b9528acb4421d560cc47f6fac789a5b9b46))
* converter state sync para ESM (require nao funciona em vite.config.ts ESM) ([332f084](https://github.com/HugoJunioor/FlowDesk/commit/332f084717a245e785d224d954cf01555d8e7fba))
* copiar link com feedback toast + melhor deteccao de 'Falta de retorno da equipe' ([e4f27c0](https://github.com/HugoJunioor/FlowDesk/commit/e4f27c0e3d85731ebd39f372509e8afca90c57da))
* corrigir acesso via IP de rede (HMR websocket + CSP) ([21ae6c7](https://github.com/HugoJunioor/FlowDesk/commit/21ae6c7787f39f4e63e5fff9638dda04824ec2e4))
* corrigir fluxo de troca de senha no primeiro acesso ([54e6eaa](https://github.com/HugoJunioor/FlowDesk/commit/54e6eaaca464b05ec18b0bf7e34c46a68c501104))
* corrigir hash SHA-256 do username para login funcionar ([da65035](https://github.com/HugoJunioor/FlowDesk/commit/da650356a1d9a265ff981a74aea36b441f767534))
* corrigir script powershell removendo caracteres unicode ([f61059a](https://github.com/HugoJunioor/FlowDesk/commit/f61059ab2a35336e5e395a93aa50bfa7b935cb2e))
* **demand-modal:** compactar fields (p-4 -&gt; p-3, space-y-5 -&gt; space-y-3) ([9394bb9](https://github.com/HugoJunioor/FlowDesk/commit/9394bb9ff35f2e7cda9bcd4e48daca1fb81e80af))
* **demand-modal:** harmonia de layout — coluna centralizada com max-w-4xl ([a63bf09](https://github.com/HugoJunioor/FlowDesk/commit/a63bf090e89d7e688ef823694675645b5638fe6f))
* **demand-modal:** parear Responsavel + Prioridade lado a lado em telas largas ([a025d3b](https://github.com/HugoJunioor/FlowDesk/commit/a025d3b545456a4ba27ddc9b7cd9a5ace0bb8f06))
* **demand-modal:** parear Tempo restante + Status lado a lado ([d4fd0ed](https://github.com/HugoJunioor/FlowDesk/commit/d4fd0ed9ce4b1685a867eb970678b2a3d532c4aa))
* desabilitar cache no preview server para rebuilds aparecerem no F5 ([f239c8c](https://github.com/HugoJunioor/FlowDesk/commit/f239c8c1fb4e62a77eda0fb8a5fbec7e5107e28e))
* detectar VPN do OpenVPN e mostrar descricao do adapter ([d90e819](https://github.com/HugoJunioor/FlowDesk/commit/d90e8199fa4e051e255f4857af65099faf5bb299))
* distinguir conclusao via 🟢 atual vs preservada (closureSource) ([304a948](https://github.com/HugoJunioor/FlowDesk/commit/304a94873accb27c299bed109948a5160b2a3acd))
* fallback para crypto.subtle e crypto.randomUUID em contexto nao-seguro ([ae9d185](https://github.com/HugoJunioor/FlowDesk/commit/ae9d18582de3f547a0a5dd50d11e830bb797659a))
* filtro corrigido - importar todas demandas de workflow ([732f809](https://github.com/HugoJunioor/FlowDesk/commit/732f80904fa6ce1c75852565d30925e0db22c993))
* importar somente demandas de Fluxo de Trabalho do Slack ([0eef447](https://github.com/HugoJunioor/FlowDesk/commit/0eef4475d52d42888bfda0ee32832b080b86972f))
* **local-slack:** carregar .env via dotenv pro plugin Vite ler SLACK_BOT_TOKEN ([8fd8e90](https://github.com/HugoJunioor/FlowDesk/commit/8fd8e9099c18a186771603ad442b58b3e7fd217f))
* **mention:** clicar no dropdown nao fecha mais o modal ([#5](https://github.com/HugoJunioor/FlowDesk/issues/5)) ([a3f25f1](https://github.com/HugoJunioor/FlowDesk/commit/a3f25f1ab08f6ee4ba6a471fd5191a4e3151418b))
* **mention:** impedir click no portal de fechar dialog/blur textarea ([633243e](https://github.com/HugoJunioor/FlowDesk/commit/633243e8c8b4a02d8dc99b0e293d9ec55f4d6b21))
* **mention:** seleciona ao clicar + acompanha scroll + debug verbose envio ([68f87dd](https://github.com/HugoJunioor/FlowDesk/commit/68f87dda2d0ccb3d542dd28580ded80caa37c070))
* **modal:** mover useState pra ANTES do early return (regra dos hooks) ([69cbc36](https://github.com/HugoJunioor/FlowDesk/commit/69cbc3657f5eee2b3b73a0528c9f5efbccf2c0e5))
* mover temas para fora de [@layer](https://github.com/layer) base garantindo prioridade CSS ([5c0ccc6](https://github.com/HugoJunioor/FlowDesk/commit/5c0ccc62bafcb4f4163670c4c0551527c72ec357))
* override manual sempre tem prioridade sobre auto-deteccao ([2f0882b](https://github.com/HugoJunioor/FlowDesk/commit/2f0882ba59401ef8302d8337337f81084a38d9ef))
* preservar concluida antes de marcar em_andamento ([ccbc6c0](https://github.com/HugoJunioor/FlowDesk/commit/ccbc6c0e95f45cca92141dd72e4940d2d6733676))
* relatorio BI quebrado por variaveis nao declaradas + toast de erro ([fd28fc2](https://github.com/HugoJunioor/FlowDesk/commit/fd28fc2fd9e89449f2303e059b541218c02bc3e5))
* remover deteccao de CONCLUIDA por texto (so reaction conclui) ([6097dc3](https://github.com/HugoJunioor/FlowDesk/commit/6097dc3d0a6d7735f89c1d9ae2dc11473e42999b))
* remover vulnerabilidades e dados sensiveis do codigo rastreado ([05cecd9](https://github.com/HugoJunioor/FlowDesk/commit/05cecd9cf1ac751a430d4cbdb44ad10018cdbb2f))
* **report-bi:** declarar slaRespOk/slaRespBreach faltantes em reportGenerator ([670af39](https://github.com/HugoJunioor/FlowDesk/commit/670af398bd6108ef7be603b6102d1d5641fb1b98))
* **report:** BI/Excel respeitam filtros locais dos graficos ([#6](https://github.com/HugoJunioor/FlowDesk/issues/6)) ([d5ea41c](https://github.com/HugoJunioor/FlowDesk/commit/d5ea41cfe8fb83d98ac21ae02cad8132d0b0cbcd))
* responsividade completa mobile + remover nomes ficticios ([ad3e492](https://github.com/HugoJunioor/FlowDesk/commit/ad3e492bc63a02954170fa7e3d4917c69a9c1675))
* responsividade kanban - remover scroll cortando cards ([fc1e87b](https://github.com/HugoJunioor/FlowDesk/commit/fc1e87b7674c92cf1c61230a38eb6f9c09a598fd))
* scrollbar suave compativel com dark/light mode ([57da33c](https://github.com/HugoJunioor/FlowDesk/commit/57da33c4741a4c745a827ccbe801ac61f77968ae))
* sidebar nao reexpande ao navegar + cor do nome segue tema ([9001491](https://github.com/HugoJunioor/FlowDesk/commit/90014912e398a71c94273c10155fa8e9bf7529ec))
* sincronizar slack antes do build inicial no modo share ([d9ba1c4](https://github.com/HugoJunioor/FlowDesk/commit/d9ba1c48cf0d5a9b4f97a5e911f4fc8ffedabe04))
* **sla:** ajusta motivos de exclusao do calculo de breach ([#11](https://github.com/HugoJunioor/FlowDesk/issues/11)) ([76ad5a9](https://github.com/HugoJunioor/FlowDesk/commit/76ad5a9b5d61e21ff0e9bb016ed4f426c6fa1be3))
* **slack:** atribuicao via mention do remetente (sem chat:write.customize) ([0d1015b](https://github.com/HugoJunioor/FlowDesk/commit/0d1015bd2a7e7e82b2f925cb07a5b6c29b30bd02))
* **sla:** excluir do calculo SO quando a demanda DE FATO atrasou ([15d071b](https://github.com/HugoJunioor/FlowDesk/commit/15d071b53fcbf90d4667370c49df576761f06bed))
* **sla:** exclusao por culpa do cliente vale apenas de abril/2026 em diante ([fccc48d](https://github.com/HugoJunioor/FlowDesk/commit/fccc48df173a87b6aeee4b6175d339859449e8d4))
* **sla:** regra de fechamento via reaction + tempos zerados ([#9](https://github.com/HugoJunioor/FlowDesk/issues/9)) ([9e7dc3f](https://github.com/HugoJunioor/FlowDesk/commit/9e7dc3facf4d8f2b060fd09da9405aabd8ac08d3))
* SLAs corretos, troca de status e countdown ajustado ([d0a25e0](https://github.com/HugoJunioor/FlowDesk/commit/d0a25e067090bb6785fcc32b3d4ae9d18a77d7b0))
* **stale:** conta so interacoes da EQUIPE (ignora cobrancas do cliente) ([#31](https://github.com/HugoJunioor/FlowDesk/issues/31)) ([55c37d6](https://github.com/HugoJunioor/FlowDesk/commit/55c37d65e9806d6d3b302543c9feb08230eec740))
* **state-sync:** liberar /__token pra rede privada (LAN + VPN) ([ccd4d9e](https://github.com/HugoJunioor/FlowDesk/commit/ccd4d9edb7a191d4e379cc0aa3f8be8b87bef4a0))
* sync concluida tem prioridade sobre override manual desatualizado ([c6f83ec](https://github.com/HugoJunioor/FlowDesk/commit/c6f83ecc274decc2abf0ca9f41c9f5aa202b39db))
* **theme:** psicodelico mais vivo e menos rosa, dark mode preto-dominante ([1555807](https://github.com/HugoJunioor/FlowDesk/commit/15558079e83031cf6c034fec32adafb4eb107e60))
* unificar calculo de metricas/SLA entre dashboard e relatorios ([1588412](https://github.com/HugoJunioor/FlowDesk/commit/158841205dee4271ecbaafa162616b9bbc47770b))
* usar 'd.threadReplies || []' antes de acessar length/map. ([a9627a4](https://github.com/HugoJunioor/FlowDesk/commit/a9627a4d4d6288282e26f70892a8528e944ea144))
* validar privilegios admin no script de firewall ([a1e10da](https://github.com/HugoJunioor/FlowDesk/commit/a1e10da875dfefb770242f7118705ca160d14ea6))
* wirar /auth/slack/* no handler do stateSync (estava caindo no SPA fallback) ([14d79cf](https://github.com/HugoJunioor/FlowDesk/commit/14d79cfc84e30652c5a2cb7ade11de886779cd2e))


### Performance Improvements

* otimizar sync do slack e proteger contra regressao de status ([dc45f4d](https://github.com/HugoJunioor/FlowDesk/commit/dc45f4dc46a55c7b2e480dd2c52e4c6387c9ba26))

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
