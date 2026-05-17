# Changelog

Todas as mudanças relevantes deste projeto seguem o formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento [SemVer](https://semver.org/lang/pt-BR/).

## 1.0.0 (2026-05-17)


### Features

* 3 graficos mensais no dashboard (modo Anual) ([9c47f0b](https://github.com/HugoJunioor/FlowDesk/commit/9c47f0b04449a284fc403833a58e16edc6c329f7))
* 6 novos temas (Neon, Aurora, Midnight, Coral, Menta, Cereja) + sidebar traduzida ([c328738](https://github.com/HugoJunioor/FlowDesk/commit/c328738e7abb3c33afb6a57765c79e6ef21271f5))
* adicionar categoria + reacao check como conclusao + melhorias ([e1696c5](https://github.com/HugoJunioor/FlowDesk/commit/e1696c5275740d21f152be1553482bc165119677))
* adicionar novo responsavel com persistencia localStorage ([84d0204](https://github.com/HugoJunioor/FlowDesk/commit/84d020436132228a565278c203d399bffc9beba1))
* adicionar watcher de sync do slack a cada 5 minutos ([ef692b4](https://github.com/HugoJunioor/FlowDesk/commit/ef692b4239a68ae8435626e8f30ee09e642f0ee1))
* **ai:** classifica motivo de contato baseado em 158 demandas de abril ([#16](https://github.com/HugoJunioor/FlowDesk/issues/16)) ([021f4ac](https://github.com/HugoJunioor/FlowDesk/commit/021f4ac6909e7e29d46752756e80c96a58d9f7b5))
* analise automatica de status de 48 demandas reais ([9f0c0c3](https://github.com/HugoJunioor/FlowDesk/commit/9f0c0c371bb6e78b242bcddc85f8cb54a74adbed))
* analise contextual de conversa + encaminhamento como resolucao ([a5829a6](https://github.com/HugoJunioor/FlowDesk/commit/a5829a6a4daa986be3350479b8e495a8c5b03ab6))
* apenas circulo verde fecha novas demandas ([e45dda4](https://github.com/HugoJunioor/FlowDesk/commit/e45dda4f91862c3772b1c648048b1bb77dae7467))
* **api:** apps/api skeleton seguindo padrao Just (Fase 1A) ([#35](https://github.com/HugoJunioor/FlowDesk/issues/35)) ([f6ac8c8](https://github.com/HugoJunioor/FlowDesk/commit/f6ac8c82638110ba1b36fa21c16b2d1b8e241a42))
* **api:** audit log middleware + helper service (LGPD compliance) ([#47](https://github.com/HugoJunioor/FlowDesk/issues/47)) ([cc7b307](https://github.com/HugoJunioor/FlowDesk/commit/cc7b307c10b55578a68347a4148e564c43a9c40c))
* **api:** cron server-side de SLA reminders + business-hours helper ([#48](https://github.com/HugoJunioor/FlowDesk/issues/48)) ([1688786](https://github.com/HugoJunioor/FlowDesk/commit/16887868680bbd542cd5ef6814b4c52429cd5697))
* **api:** endpoint GET /api/v1/auditoria pra master consultar trilha ([#52](https://github.com/HugoJunioor/FlowDesk/issues/52)) ([1ae5ae4](https://github.com/HugoJunioor/FlowDesk/commit/1ae5ae4803399b77bf4c9e6958029914dac6e10a))
* **api:** GET /health/detailed com checks de DB, disco e memoria ([#71](https://github.com/HugoJunioor/FlowDesk/issues/71)) ([341ea4d](https://github.com/HugoJunioor/FlowDesk/commit/341ea4d01e3ad54fb2c6de9556e551cd90b80543))
* **api:** modulo auth com JWT + refresh token HttpOnly cookie (Fase 3) ([#39](https://github.com/HugoJunioor/FlowDesk/issues/39)) ([b4ae198](https://github.com/HugoJunioor/FlowDesk/commit/b4ae1986bc06199940e5acc0e7f2003f465e4914))
* **api:** modulo demanda consolidado Slack + Infra (Fase 6) ([#42](https://github.com/HugoJunioor/FlowDesk/issues/42)) ([1e2f527](https://github.com/HugoJunioor/FlowDesk/commit/1e2f5278af6267212f3dd0cc4e547c0ad33d8920))
* **api:** modulo nota com checklist + ownership server-side (Fase 5) ([#41](https://github.com/HugoJunioor/FlowDesk/issues/41)) ([1fd81d5](https://github.com/HugoJunioor/FlowDesk/commit/1fd81d500258efa6874f8ad1cc3aa7d2d3a18b9e))
* **api:** modulo notificacao com inbox + preferencias (Fase 4) ([#40](https://github.com/HugoJunioor/FlowDesk/issues/40)) ([45223e8](https://github.com/HugoJunioor/FlowDesk/commit/45223e8deec8d821924ff66896ebff705da17eaf))
* **api:** OpenAPI 3.1 + Swagger UI ([#85](https://github.com/HugoJunioor/FlowDesk/issues/85)) ([8e1c350](https://github.com/HugoJunioor/FlowDesk/commit/8e1c3507aedf53666687db319a442d5b0d72862c))
* **api:** rate limit IP no login + LGPD right-to-be-forgotten ([#72](https://github.com/HugoJunioor/FlowDesk/issues/72)) ([c276b9d](https://github.com/HugoJunioor/FlowDesk/commit/c276b9dafea53fc71aaeb20961095d6d9c5c1831))
* **api:** schema Postgres + migrations + seeds + docker-compose (Fase 2) ([#38](https://github.com/HugoJunioor/FlowDesk/issues/38)) ([5623a01](https://github.com/HugoJunioor/FlowDesk/commit/5623a0148767b1326afcb16e6be7d2891ffc3af7))
* **api:** script de import JSON -&gt; Postgres (Fase 9) ([#45](https://github.com/HugoJunioor/FlowDesk/issues/45)) ([84b5b4a](https://github.com/HugoJunioor/FlowDesk/commit/84b5b4ac5f84d376fac28ec360cd4a45faadb3ca))
* **api:** threadReplies + closure pra demandas Slack (Fase 7) ([#43](https://github.com/HugoJunioor/FlowDesk/issues/43)) ([7cff296](https://github.com/HugoJunioor/FlowDesk/commit/7cff296685c6aa27fd48f47f3c7ec2e7e03c5a7e))
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
* **excel:** adiciona coluna Motivo de Contato classificado por IA ([#18](https://github.com/HugoJunioor/FlowDesk/issues/18)) ([2ab2203](https://github.com/HugoJunioor/FlowDesk/commit/2ab2203b8d2cf3eb69f2c1c270073948e4afdb69))
* export PDF do relatorio BI + botao sync manual ([#77](https://github.com/HugoJunioor/FlowDesk/issues/77)) ([94c2896](https://github.com/HugoJunioor/FlowDesk/commit/94c2896a5366a27f8ea96d373d6dd88e9c48d88d))
* filtro por data e cliente, stats clicaveis ([65fa430](https://github.com/HugoJunioor/FlowDesk/commit/65fa430f28515e1ab3f34b22febbf1dca4020374))
* filtro SLA, tema claro relatorios, anexos, observacao de conclusao e melhorias ([c9a8154](https://github.com/HugoJunioor/FlowDesk/commit/c9a81540583aa7861109dedf1f9c8b1a77fa04d4))
* filtros de periodo (hoje/semanal/mensal) + calendario shadcn ([aa18129](https://github.com/HugoJunioor/FlowDesk/commit/aa1812958058d7000935c1bd83bc469bd7802eda))
* filtros locais nos graficos + sidebar logo clicavel ([e592110](https://github.com/HugoJunioor/FlowDesk/commit/e592110f9783f0332d757ed005d9918c642100da))
* forcar tema claro na tela de login + rodape powered by ([a5e85da](https://github.com/HugoJunioor/FlowDesk/commit/a5e85da8d5992638bf9c8489e1b20dc30e1189ed))
* gerenciamento de Grupos de Demandas (roteamento canais Slack) ([0adb387](https://github.com/HugoJunioor/FlowDesk/commit/0adb387b86527bf6c4f44ae54cf9a6e0a52a8135))
* horas uteis no SLA e troca de responsavel ([13c90ac](https://github.com/HugoJunioor/FlowDesk/commit/13c90aca4c3fdc330959c80c7347c39b8c4d17c6))
* idioma por usuario, aparencia compacta, feriados perenes ([fde3e55](https://github.com/HugoJunioor/FlowDesk/commit/fde3e55687a0826105c916438deb7f0df2c84fe6))
* **infra:** detalhe da demanda em sheet + tabs por status (incl. Em atraso) ([#22](https://github.com/HugoJunioor/FlowDesk/issues/22)) ([37da636](https://github.com/HugoJunioor/FlowDesk/commit/37da6367ffea3ef0b7fbeaf5ef45f69d7f940e9a))
* **infra:** docker-compose.prod.yml + nginx + guia DEPLOY.md expandido ([#84](https://github.com/HugoJunioor/FlowDesk/issues/84)) ([ee3ff4d](https://github.com/HugoJunioor/FlowDesk/commit/ee3ff4d73d0bde0a292eeb122160f08b803058e6))
* **infra:** novo modulo de demandas internas (SQL + Deploy) ([#20](https://github.com/HugoJunioor/FlowDesk/issues/20)) ([c9df1dd](https://github.com/HugoJunioor/FlowDesk/commit/c9df1dd23fabf8c8b2b42b5c4baad6be6a7c40df))
* **infra:** quadros KPI por status + filtros SQL/Deploy ([#26](https://github.com/HugoJunioor/FlowDesk/issues/26)) ([6fa500d](https://github.com/HugoJunioor/FlowDesk/commit/6fa500d59c37044ff810ba3475398d4d0167d834))
* **infra:** SQL usa dropdown de Tipo de Execucao em vez de titulo livre ([#21](https://github.com/HugoJunioor/FlowDesk/issues/21)) ([bde6b3f](https://github.com/HugoJunioor/FlowDesk/commit/bde6b3fc2d67bc6fcf24eeeef2c396633d3896d5))
* legenda + subtitulos + linha meta 90% nos graficos mensais ([eacd490](https://github.com/HugoJunioor/FlowDesk/commit/eacd49033736c859e6c8c51f429fb5d3394ded99))
* **local:** endpoints /slack/* no Vite dev server (dispensa Railway) ([2f67356](https://github.com/HugoJunioor/FlowDesk/commit/2f67356ae1e0f08ec1cc3d7683b36103470e9ea7))
* manter motivo da expiracao nos cards de concluidas fora do SLA ([0444b66](https://github.com/HugoJunioor/FlowDesk/commit/0444b66cffd6d9df9a382d1482a088d21ab0ef47))
* **mention:** mascara @&lt;ID&gt; com nome no textarea, expande no envio ([c74ba86](https://github.com/HugoJunioor/FlowDesk/commit/c74ba861f31d27e99fd5de8a74f9ff696e16aaec))
* **mention:** navegacao por teclado (Up/Down/Enter/Esc) + click highlight ([ecd9bd2](https://github.com/HugoJunioor/FlowDesk/commit/ecd9bd2edf3400fe6cb87313365e1636e00c4901))
* meta SLA 80% + novas demandas sem prioridade viram P3 ([a114dbd](https://github.com/HugoJunioor/FlowDesk/commit/a114dbd0d4758c92d589cb57e833caf6cfb408af))
* modo demo + config Vercel para portfolio ([4e68da7](https://github.com/HugoJunioor/FlowDesk/commit/4e68da7c688fdec169800a6fbff5f4f443929cf2))
* modulo de Grupos com permissoes por modulo e acao ([ff816d3](https://github.com/HugoJunioor/FlowDesk/commit/ff816d3ee7ff8440bd6f18aca0bb4198354697a8))
* modulo Demandas Slack com kanban, filtros e countdown ([365d9b6](https://github.com/HugoJunioor/FlowDesk/commit/365d9b62f06052ccb2cb09953255146cb4cba9d2))
* modulo Demandas SQL isolado (canal #operacoes-sql) ([5ffc3be](https://github.com/HugoJunioor/FlowDesk/commit/5ffc3beaf57635467051333dffa087b2427d0598))
* **monorepo:** move web app pra apps/web/ + workspaces npm (Fase 1B) ([#36](https://github.com/HugoJunioor/FlowDesk/issues/36)) ([f9647fb](https://github.com/HugoJunioor/FlowDesk/commit/f9647fbe3d7500ef2f3793710445971e0663296c))
* **notes:** bloco de notas pessoal (Kanban + Lista) ([#25](https://github.com/HugoJunioor/FlowDesk/issues/25)) ([4aaba2e](https://github.com/HugoJunioor/FlowDesk/commit/4aaba2e3bd43870cae267bd28bcbf66a034da61e))
* **notifications:** inbox de eventos no FlowDesk (sino + página + storage) ([#23](https://github.com/HugoJunioor/FlowDesk/issues/23)) ([a833056](https://github.com/HugoJunioor/FlowDesk/commit/a8330566f859a2412996a329291052ae14a25891))
* **notifications:** lembretes SLA via engine no polling do sino ([#24](https://github.com/HugoJunioor/FlowDesk/issues/24)) ([7f52ec2](https://github.com/HugoJunioor/FlowDesk/commit/7f52ec20939392ee8c20f0a2774160d5469fb383))
* **observability:** integracao Sentry opt-in (api + web) ([#46](https://github.com/HugoJunioor/FlowDesk/issues/46)) ([03017e9](https://github.com/HugoJunioor/FlowDesk/commit/03017e9511c6b4eb8c3f810ac6c773f14c3c3146))
* persistencia local + separacao dados reais do Git ([c830bec](https://github.com/HugoJunioor/FlowDesk/commit/c830bec1a998cbe012bf7e32db5b59b6e6ce2a84))
* redesign tela de login - fundo azul full, area branca lateral ([e3759c1](https://github.com/HugoJunioor/FlowDesk/commit/e3759c15c40ccb57b8a95553c9da5afa971cc00c))
* relatorio interativo, filtro anual, analise de status no sync e persistencia PostgreSQL ([2e1aec6](https://github.com/HugoJunioor/FlowDesk/commit/2e1aec61b6fb78547f41f3262f330d7f42cb7261))
* **report:** produto detectado por workflow name + exibido no BI/Excel ([#17](https://github.com/HugoJunioor/FlowDesk/issues/17)) ([6a95bbc](https://github.com/HugoJunioor/FlowDesk/commit/6a95bbc3da468eaa2941253278651adb82ef1ec0))
* restyling selects com shadcn + SLA primeira resposta e resolucao ([0d08e69](https://github.com/HugoJunioor/FlowDesk/commit/0d08e69af78093667e088f8ca616f7f2c64c5c39))
* script "npm run share" para acesso remoto rapido ([5112545](https://github.com/HugoJunioor/FlowDesk/commit/5112545deab478126f2daf194cfe045cbc68761e))
* script para resetar senha de usuario ([dc66185](https://github.com/HugoJunioor/FlowDesk/commit/dc66185fd55d7e47bad25da890ceabd5a22985a9))
* **scripts:** adiciona script de backup com pg_dump e zip de web/data ([#70](https://github.com/HugoJunioor/FlowDesk/issues/70)) ([c49bf2a](https://github.com/HugoJunioor/FlowDesk/commit/c49bf2aa5f8fd9550748373084e1cb346ddc534a))
* **security:** hardening pre-prod (PR A — rate limit, CORS env, /health, logs) ([#32](https://github.com/HugoJunioor/FlowDesk/issues/32)) ([4c017f0](https://github.com/HugoJunioor/FlowDesk/commit/4c017f0fb8077f1ed0a263a485e616c277451673))
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
* **sla:** fluxo :loading: pra Sitef/Conciliacao + 1a resposta efetiva ([#15](https://github.com/HugoJunioor/FlowDesk/issues/15)) ([47c2225](https://github.com/HugoJunioor/FlowDesk/commit/47c22254c8640fbd89d613e21e63cb5fef1221b0))
* so circulo verde marca como concluida (remover deteccao por texto) ([144ed70](https://github.com/HugoJunioor/FlowDesk/commit/144ed70e2de7587df71d49050ac8d4e5a26cfdb9))
* **sql:** SLA em horario comercial, aprovacao por texto, coluna concluido ([5278ce8](https://github.com/HugoJunioor/FlowDesk/commit/5278ce8eb5597bf5ec28f75a38879db2be3475b9))
* **stale:** badge "sem interacao" no Infra + formato com "e" entre dias/horas ([#30](https://github.com/HugoJunioor/FlowDesk/issues/30)) ([d50da05](https://github.com/HugoJunioor/FlowDesk/commit/d50da050e2d1a0d6713e2fbca1c31b9c2b4e252b))
* **sync-sql:** aceitar canais extras via SLACK_OPS_EXTRA_CHANNELS ([39393ec](https://github.com/HugoJunioor/FlowDesk/commit/39393ecd94cc579d8ac10d80c72e937745f99f1d))
* **sync:** description traz corpo completo apos 'Descricao da demanda' ([d4398bc](https://github.com/HugoJunioor/FlowDesk/commit/d4398bc65d1fea1a099d758dd4159cf665e18383))
* **sync:** identifica equipe por dominio de email (auto, sem editar lista) ([#12](https://github.com/HugoJunioor/FlowDesk/issues/12)) ([97a1b1d](https://github.com/HugoJunioor/FlowDesk/commit/97a1b1d3f9df8202c8596950902e0e96ff214670))
* **sync:** syncSlack.cjs captura files das mensagens e replies ([5411af6](https://github.com/HugoJunioor/FlowDesk/commit/5411af67567494462f74b8190d80afb0a494c80d))
* **theme:** adicionar tema Psicodelico (17o tema) ([1445d18](https://github.com/HugoJunioor/FlowDesk/commit/1445d186296c2629eac1abec46f5f832b93b9168))
* **thread:** edit/delete proprios + reorder + thumbs menores + composer clean ([0468e04](https://github.com/HugoJunioor/FlowDesk/commit/0468e0462adeff5c831f4f0ea4d7aa0ffbc5c957))
* **thread:** optimistic update — resposta aparece na thread imediatamente ([08e795d](https://github.com/HugoJunioor/FlowDesk/commit/08e795d334aa261ef6bf7afd2da629c2c0a5fe1f))
* **thread:** refresh sob demanda + auto-refresh apos envio + click do mention ([b175114](https://github.com/HugoJunioor/FlowDesk/commit/b175114da7adfdafd8fa6409cf30f4fd0a9c8465))
* trocar tema Cereja por Flamengo (rubro-negro) ([e225872](https://github.com/HugoJunioor/FlowDesk/commit/e225872d1b9c8f54f75d0cf492dd83c1beab89f0))
* **types:** novos tipos Sitef/Conciliacao + categorias + P3 default ([#14](https://github.com/HugoJunioor/FlowDesk/issues/14)) ([a7b360d](https://github.com/HugoJunioor/FlowDesk/commit/a7b360dace58466bd53d8c787b905b4769f3eed5))
* verificador automatico de status por analise de respostas ([7d4b98e](https://github.com/HugoJunioor/FlowDesk/commit/7d4b98eb85506762dfd88044f6e8a2a3d3dd747c))
* vincular tema ao perfil do usuario ([9ddafff](https://github.com/HugoJunioor/FlowDesk/commit/9ddafffa506f9ba3e688fb8e76483c246d20e934))
* visualização em lista com agrupamento e filtros melhorados ([9a07d98](https://github.com/HugoJunioor/FlowDesk/commit/9a07d983fad80d2b3d251325036f5ec692af0c2a))
* **web:** atalhos de teclado globais + diff visual na auditoria ([#73](https://github.com/HugoJunioor/FlowDesk/issues/73)) ([4c778f2](https://github.com/HugoJunioor/FlowDesk/commit/4c778f2bcecb0f0e40cd02de7891006956651821))
* **web:** AuditoriaPage master-only (consome GET /api/v1/auditoria) ([#56](https://github.com/HugoJunioor/FlowDesk/issues/56)) ([77d2ff7](https://github.com/HugoJunioor/FlowDesk/commit/77d2ff7f14b1527217af339dcd75f3231b9df784))
* **web:** ConfiguracoesV2Page com prefs de notificacao via API ([#61](https://github.com/HugoJunioor/FlowDesk/issues/61)) ([2058342](https://github.com/HugoJunioor/FlowDesk/commit/20583429ebeab506352b7f40caf7f9b68409546d))
* **web:** DemandaDetalheSheet com thread replies + form de reply ([#63](https://github.com/HugoJunioor/FlowDesk/issues/63)) ([794262f](https://github.com/HugoJunioor/FlowDesk/commit/794262f427cec98a663e65cdbac2a81fb5f4a76a))
* **web:** export CSV na AuditoriaPage (LGPD-friendly) ([#64](https://github.com/HugoJunioor/FlowDesk/issues/64)) ([126992e](https://github.com/HugoJunioor/FlowDesk/commit/126992e82fb0a1bd20ff536cefcb1c4f14d935a4))
* **web:** filtros avancados em Demandas + CHANGELOG atualizado ([#75](https://github.com/HugoJunioor/FlowDesk/issues/75)) ([2a3afb9](https://github.com/HugoJunioor/FlowDesk/commit/2a3afb9ce1abc7e533623149e2e47b33703ae4db))
* **web:** infra HTTP + modulo auth padrao Just (Fase 8) ([#44](https://github.com/HugoJunioor/FlowDesk/issues/44)) ([64b56da](https://github.com/HugoJunioor/FlowDesk/commit/64b56dacaa4eef0a359d982ab9a239b33b324168))
* **web:** LoginV2Page como template do padrao Just no frontend ([#50](https://github.com/HugoJunioor/FlowDesk/issues/50)) ([30bcc6e](https://github.com/HugoJunioor/FlowDesk/commit/30bcc6ed9e2db0c722071a1bd6c7336215885e1f))
* **web:** modulo demanda + DemandasV2Page (lista + actions) ([#62](https://github.com/HugoJunioor/FlowDesk/issues/62)) ([3fb15b5](https://github.com/HugoJunioor/FlowDesk/commit/3fb15b516711bf50fca7275c02c703ed6f1d61b9))
* **web:** modulo nota + NotasV2Page (consome API REST, padrao Just) ([#58](https://github.com/HugoJunioor/FlowDesk/issues/58)) ([9b43802](https://github.com/HugoJunioor/FlowDesk/commit/9b43802bfcd3620e8ded96ab50597b7eaf3e776d))
* **web:** modulo notificacao + NotificacoesV2Page consumindo API ([#59](https://github.com/HugoJunioor/FlowDesk/issues/59)) ([f7c39b8](https://github.com/HugoJunioor/FlowDesk/commit/f7c39b8dbef2a4960efe76062e8be5dfee52fcd7))
* **web:** onboarding wizard + modo apresentacao no dashboard ([#74](https://github.com/HugoJunioor/FlowDesk/issues/74)) ([ce64b79](https://github.com/HugoJunioor/FlowDesk/commit/ce64b79b6a4ad9e21587e9e560e4d8722ac45684))
* **web:** pagina /sobre com versao, build info e status da API ([#83](https://github.com/HugoJunioor/FlowDesk/issues/83)) ([36c85e6](https://github.com/HugoJunioor/FlowDesk/commit/36c85e6fd4bf59a83fa2fadba7681760c3a9a93e))
* **web:** polling 401 back-off nos sinos + botao ativar notificacoes desktop ([#76](https://github.com/HugoJunioor/FlowDesk/issues/76)) ([f2e5565](https://github.com/HugoJunioor/FlowDesk/commit/f2e55654a9d8c09518342dda7ebc9cd368d58812))
* **web:** secao BETA no sidebar com links pras telas v2 (master only) ([#60](https://github.com/HugoJunioor/FlowDesk/issues/60)) ([70a8258](https://github.com/HugoJunioor/FlowDesk/commit/70a8258ffb15f4e8ce9f775d539bd0a945310540))
* **web:** StatusPage com health check da API (master only) ([#67](https://github.com/HugoJunioor/FlowDesk/issues/67)) ([a158bfa](https://github.com/HugoJunioor/FlowDesk/commit/a158bfa5b69198796b563973df703f6cd158f638))


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
* **mention:** clicar no dropdown nao fecha mais o modal ([#5](https://github.com/HugoJunioor/FlowDesk/issues/5)) ([2a439dc](https://github.com/HugoJunioor/FlowDesk/commit/2a439dcbdf42b384dc3add6e3f9fc551031eabe1))
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
* **report:** BI/Excel respeitam filtros locais dos graficos ([#6](https://github.com/HugoJunioor/FlowDesk/issues/6)) ([f59cd00](https://github.com/HugoJunioor/FlowDesk/commit/f59cd00279c81f92eb7c88c4d8bffa93198c25eb))
* responsividade completa mobile + remover nomes ficticios ([ad3e492](https://github.com/HugoJunioor/FlowDesk/commit/ad3e492bc63a02954170fa7e3d4917c69a9c1675))
* responsividade kanban - remover scroll cortando cards ([fc1e87b](https://github.com/HugoJunioor/FlowDesk/commit/fc1e87b7674c92cf1c61230a38eb6f9c09a598fd))
* scrollbar suave compativel com dark/light mode ([57da33c](https://github.com/HugoJunioor/FlowDesk/commit/57da33c4741a4c745a827ccbe801ac61f77968ae))
* sidebar nao reexpande ao navegar + cor do nome segue tema ([9001491](https://github.com/HugoJunioor/FlowDesk/commit/90014912e398a71c94273c10155fa8e9bf7529ec))
* sincronizar slack antes do build inicial no modo share ([d9ba1c4](https://github.com/HugoJunioor/FlowDesk/commit/d9ba1c48cf0d5a9b4f97a5e911f4fc8ffedabe04))
* **sla:** ajusta motivos de exclusao do calculo de breach ([#11](https://github.com/HugoJunioor/FlowDesk/issues/11)) ([c57791d](https://github.com/HugoJunioor/FlowDesk/commit/c57791da722d4c23515c506d208e865ae1e58bae))
* **slack:** atribuicao via mention do remetente (sem chat:write.customize) ([0d1015b](https://github.com/HugoJunioor/FlowDesk/commit/0d1015bd2a7e7e82b2f925cb07a5b6c29b30bd02))
* **sla:** excluir do calculo SO quando a demanda DE FATO atrasou ([15d071b](https://github.com/HugoJunioor/FlowDesk/commit/15d071b53fcbf90d4667370c49df576761f06bed))
* **sla:** exclusao por culpa do cliente vale apenas de abril/2026 em diante ([fccc48d](https://github.com/HugoJunioor/FlowDesk/commit/fccc48df173a87b6aeee4b6175d339859449e8d4))
* **sla:** regra de fechamento via reaction + tempos zerados ([#9](https://github.com/HugoJunioor/FlowDesk/issues/9)) ([cef3fc6](https://github.com/HugoJunioor/FlowDesk/commit/cef3fc6d4fa50c00541b61819a38b5916d1b493f))
* SLAs corretos, troca de status e countdown ajustado ([d0a25e0](https://github.com/HugoJunioor/FlowDesk/commit/d0a25e067090bb6785fcc32b3d4ae9d18a77d7b0))
* **stale:** conta so interacoes da EQUIPE (ignora cobrancas do cliente) ([#31](https://github.com/HugoJunioor/FlowDesk/issues/31)) ([1e9e4a9](https://github.com/HugoJunioor/FlowDesk/commit/1e9e4a93965079ba70634e8e5886f5ce499a4c1b))
* **state-sync:** liberar /__token pra rede privada (LAN + VPN) ([ccd4d9e](https://github.com/HugoJunioor/FlowDesk/commit/ccd4d9edb7a191d4e379cc0aa3f8be8b87bef4a0))
* sync concluida tem prioridade sobre override manual desatualizado ([c6f83ec](https://github.com/HugoJunioor/FlowDesk/commit/c6f83ecc274decc2abf0ca9f41c9f5aa202b39db))
* **theme:** psicodelico mais vivo e menos rosa, dark mode preto-dominante ([1555807](https://github.com/HugoJunioor/FlowDesk/commit/15558079e83031cf6c034fec32adafb4eb107e60))
* unificar calculo de metricas/SLA entre dashboard e relatorios ([1588412](https://github.com/HugoJunioor/FlowDesk/commit/158841205dee4271ecbaafa162616b9bbc47770b))
* usar 'd.threadReplies || []' antes de acessar length/map. ([a9627a4](https://github.com/HugoJunioor/FlowDesk/commit/a9627a4d4d6288282e26f70892a8528e944ea144))
* validar privilegios admin no script de firewall ([a1e10da](https://github.com/HugoJunioor/FlowDesk/commit/a1e10da875dfefb770242f7118705ca160d14ea6))
* **web:** silenciar toast Unauthorized em Infra/Notas/Notificacoes ([#69](https://github.com/HugoJunioor/FlowDesk/issues/69)) ([8136679](https://github.com/HugoJunioor/FlowDesk/commit/8136679b07e1d6ce3310f57b743e96d2006115ce))
* wirar /auth/slack/* no handler do stateSync (estava caindo no SPA fallback) ([14d79cf](https://github.com/HugoJunioor/FlowDesk/commit/14d79cfc84e30652c5a2cb7ade11de886779cd2e))


### Performance Improvements

* otimizar sync do slack e proteger contra regressao de status ([dc45f4d](https://github.com/HugoJunioor/FlowDesk/commit/dc45f4dc46a55c7b2e480dd2c52e4c6387c9ba26))
* **web:** code splitting por rota com React.lazy + Suspense ([#51](https://github.com/HugoJunioor/FlowDesk/issues/51)) ([94d11b9](https://github.com/HugoJunioor/FlowDesk/commit/94d11b9266bd751489e81132c0f389386a44f328))

## [Unreleased]

### Adicionado
- Drawer de filtros avancados em Demandas (cliente, prioridade, periodo,
  responsavel, status) com badge de contagem de filtros ativos
- Camada de adapters multi-canal (`src/adapters/`) com contrato
  `DemandAdapter` e stub de Microsoft Teams
- Modo demo (`VITE_DEMO_MODE`) com banner de credenciais visíveis
- `.npmrc` com `legacy-peer-deps=true` (compatibilidade Vercel)
- `vercel.json` com SPA rewrites + headers de segurança
- GET `/health/detailed` com checks de DB, disco e memória
- Rate limit por IP no login + endpoint LGPD right-to-be-forgotten
- Script de backup com `pg_dump` + zip de `web/data`
- StatusPage com health check da API (master only)
- Export CSV na AuditoriaPage (LGPD-friendly)
- `DemandaDetalheSheet` com thread replies e form de reply
- Onboarding wizard e telas v2 (Notas, Notificacoes, Configuracoes,
  Auditoria, Demandas) consumindo API REST
- CI Playwright E2E (chromium, paths gate, cache de browsers)
- Modulo Infra com quadros KPI por status e filtros SQL/Deploy
- Bloco de notas pessoal (Kanban + Lista)
- Lembretes SLA via engine no polling do sino
- Inbox de eventos/notificacoes (sino + pagina + storage)

### Alterado
- README expandido com diagrama Mermaid de arquitetura, seção
  multi-canal, screenshots e badges (CI, demo, license)
- Meta de SLA padrão de 90% para 80%
- Demandas sem prioridade explícita ("conciliação", "remessa SITEF",
  etc) viram P3 automaticamente
- Sidebar sem secao BETA v2 (telas promovidas para main)

### Corrigido
- Variáveis `slaResOk` / `slaResBreach` indefinidas no
  `reportGenerator.ts` (relatório BI quebrado)
- Toast de erro no `ReportButton` (antes silenciava falhas)
- Toast Unauthorized silenciado em Infra/Notas/Notificacoes
- Conta so interacoes da equipe no badge "sem interacao" (ignora
  cobranças do cliente)

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
