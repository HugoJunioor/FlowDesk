import { SlackDemand } from "@/types/demand";

const now = new Date();
const h = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString();
const ago = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

export const mockDemands: SlackDemand[] = [
  // === P1 - Criticos ===
  {
    id: "d1", title: "Relatoria da conta Tesouro da GUJAO",
    description: "O responsavel pela empresa Gujao solicitou um relatorio detalhado da conta Tesouro. A necessidade e de uma visao consolidada e diaria, contendo valores recarregados, valores utilizados em pedidos e saldo final de cada dia.",
    priority: "p1", status: "aberta", demandType: "Tarefa/Ajuda", workflow: "Suporte SmartVale", product: "Beneficios",
    requester: { name: "Ster Brito", avatar: "" }, assignee: { name: "Bruna Queiroz", avatar: "" },
    cc: ["Bruna Queiroz"], createdAt: ago(1), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["beneficios", "relatorio"],
    slackChannel: "#cliente-smartvale", slackPermalink: "https://slack.com/app/archives/smartvale/p1", replies: 4,
    threadReplies: [
      { author: "Ster Brito", text: "Bom dia, preciso desse relatorio com urgencia, o cliente esta cobrando", timestamp: ago(0.9), isTeamMember: false },
      { author: "Bruna Queiroz", text: "Oi Ster, vou verificar com o time de dados e te retorno", timestamp: ago(0.7), isTeamMember: true },
    ],
  },
  {
    id: "d5", title: "Ajuste de cadastro e transferencia de cartao",
    description: "O cliente esta cobrando bastante e a situacao ja esta gerando desgaste. Estamos com um caso de um usuario que utiliza arranjo fechado e arranjo aberto e, apos uma alteracao de empresa, comecaram a ocorrer inconsistencias no cadastro.",
    priority: "p1", status: "em_andamento", demandType: "Tarefa/Ajuda", workflow: "Demanda Suporte", product: "",
    requester: { name: "Amanda Ferreira", avatar: "" }, assignee: { name: "Hugo", avatar: "" },
    cc: ["Hugo"], createdAt: ago(3), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["cadastro", "cartao"],
    slackChannel: "#cliente-vspay", slackPermalink: "https://slack.com/app/archives/vspay/p5", replies: 2,
    threadReplies: [
      { author: "Amanda Ferreira", text: "Boa tarde, o cliente esta cobrando bastante, situacao critica", timestamp: ago(2.5), isTeamMember: false },
      { author: "Hugo", text: "Amanda, ja estou olhando. Vou criar a task no ClickUp para acompanhar https://app.clickup.com/t/abc123", timestamp: ago(1.5), isTeamMember: true },
    ],
  },
  {
    id: "d8", title: "Erro no processamento de lote de cartoes",
    description: "Lote de 150 cartoes enviado ontem nao foi processado. Sistema retornou erro generico. Necessario reprocessar com urgencia.",
    priority: "p1", status: "em_andamento", demandType: "Problema/Bug", workflow: "Suporte SmartVale", product: "Beneficios",
    requester: { name: "Victor Augusto", avatar: "" }, assignee: { name: "Carlos R.", avatar: "" },
    cc: ["Bruna Queiroz"], createdAt: ago(2), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["beneficios", "processamento"],
    slackChannel: "#cliente-smartvale", slackPermalink: "https://slack.com/app/archives/smartvale/p8", replies: 7,
    threadReplies: [
      { author: "Victor Augusto", text: "Lote 150 cartoes nao processou, erro generico no retorno", timestamp: ago(1.8), isTeamMember: false },
      { author: "Carlos R.", text: "Estamos analisando o log do processamento. Parece ser um timeout na integracao", timestamp: ago(1.5), isTeamMember: true },
      { author: "Carlos R.", text: "Identificado o problema. Vou criar a task para o time de infra ajustar o timeout", timestamp: ago(1), isTeamMember: true },
    ],
  },
  {
    id: "d13", title: "Bloqueio de cartao por fraude",
    description: "Identificada movimentacao suspeita no cartao do usuario 55102. Necessario bloqueio imediato e investigacao.",
    priority: "p1", status: "concluida", demandType: "Problema/Bug", workflow: "Suporte SmartVale", product: "Beneficios",
    requester: { name: "Maressa Ferreira", avatar: "" }, assignee: { name: "Carlos R.", avatar: "" },
    cc: ["Bruna Queiroz"], createdAt: ago(48), dueDate: null, completedAt: ago(45),
    hasTask: false, taskLink: "", tags: ["seguranca", "fraude"],
    slackChannel: "#cliente-smartvale", slackPermalink: "https://slack.com/app/archives/smartvale/p13", replies: 5,
    threadReplies: [
      { author: "Maressa Ferreira", text: "Urgente! Movimentacao suspeita no cartao 55102", timestamp: ago(47.5), isTeamMember: false },
      { author: "Carlos R.", text: "Ja bloqueei o cartao e estou investigando as transacoes", timestamp: ago(47), isTeamMember: true },
      { author: "Carlos R.", text: "Cartao bloqueado, transacoes suspeitas estornadas. Problema resolvido, pode informar o usuario", timestamp: ago(45), isTeamMember: true },
    ],
  },

  // === P2 - Alta ===
  {
    id: "d2", title: "RETIRADA DE SALDO",
    description: "A empresa JBS FRIOS de CNPJ 07.396.238/0001-27 solicitou a retirada de R$ 60,00 do saldo Alimentacao+Refeicao do colaborador SANDRO SILVA STOLZE para a conta tesouro da organizacao.",
    priority: "p2", status: "aberta", demandType: "Tarefa/Ajuda", workflow: "Suporte SmartVale", product: "Beneficios",
    requester: { name: "Maressa Ferreira", avatar: "" }, assignee: { name: "Bruna Queiroz", avatar: "" },
    cc: ["Bruna Queiroz"], createdAt: ago(2), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["beneficios", "financeiro"],
    slackChannel: "#cliente-smartvale", slackPermalink: "https://slack.com/app/archives/smartvale/p2", replies: 2,
    threadReplies: [
      { author: "Maressa Ferreira", text: "Pessoal, conseguem fazer essa retirada?", timestamp: ago(1.8), isTeamMember: false },
    ],
  },
  {
    id: "d3", title: "QR CODE INDISPONIVEL",
    description: "A empresa Casa do ALUMINIO gerou um pedido e o qr code esta indisponivel, ja executei varias vezes pelo BKO, aparece que foi realizado, porem segue da mesma forma.",
    priority: "p2", status: "aberta", demandType: "Problema/Bug", workflow: "Suporte SmartVale", product: "Beneficios",
    requester: { name: "Maressa Ferreira", avatar: "" }, assignee: { name: "Bruna Queiroz", avatar: "" },
    cc: ["Bruna Queiroz"], createdAt: ago(1.5), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["beneficios", "bug"],
    slackChannel: "#cliente-smartvale", slackPermalink: "https://slack.com/app/archives/smartvale/p3", replies: 2,
    threadReplies: [
      { author: "Maressa Ferreira", text: "Ja tentei pelo BKO e nao resolveu", timestamp: ago(1.3), isTeamMember: false },
      { author: "Bruna Queiroz", text: "Maressa, estamos verificando no banco. Vou analisar o status do pedido", timestamp: ago(1), isTeamMember: true },
    ],
  },
  {
    id: "d11", title: "Atualizacao de tabela de tarifas",
    description: "Tabela de tarifas do cliente VSPay precisa ser atualizada conforme novo contrato aprovado.",
    priority: "p2", status: "em_andamento", demandType: "Tarefa/Ajuda", workflow: "Demanda Suporte", product: "",
    requester: { name: "Amanda Ferreira", avatar: "" }, assignee: { name: "Maria S.", avatar: "" },
    cc: ["Hugo"], createdAt: ago(5), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["financeiro", "contrato"],
    slackChannel: "#cliente-vspay", slackPermalink: "https://slack.com/app/archives/vspay/p11", replies: 4,
    threadReplies: [
      { author: "Amanda Ferreira", text: "Segue a planilha com as novas tarifas aprovadas", timestamp: ago(4.5), isTeamMember: false },
      { author: "Maria S.", text: "Recebi Amanda. Ja estou atualizando no sistema, previsao de conclusao ate amanha", timestamp: ago(4), isTeamMember: true },
      { author: "Maria S.", text: "Atualizacao realizada com sucesso. Pode verificar no sistema as novas tarifas", timestamp: ago(1), isTeamMember: true },
    ],
  },
  {
    id: "d14", title: "Integracao API parceiro LogiMax",
    description: "Configurar integracao da API de consulta de saldo com o novo parceiro LogiMax conforme documentacao tecnica enviada.",
    priority: "p2", status: "expirada", demandType: "Tarefa/Ajuda", workflow: "Demanda Suporte", product: "",
    requester: { name: "Igor Daleves", avatar: "" }, assignee: { name: "Carlos R.", avatar: "" },
    cc: [], createdAt: ago(72), dueDate: null, completedAt: null,
    hasTask: true, taskLink: "", tags: ["integracao", "api"],
    slackChannel: "#cliente-logimax", slackPermalink: "https://slack.com/app/archives/logimax/p14", replies: 6,
    threadReplies: [
      { author: "Igor Daleves", text: "Segue a doc tecnica da API do LogiMax", timestamp: ago(71), isTeamMember: false },
      { author: "Carlos R.", text: "Recebi Igor. Vou analisar a documentacao e comecar a integracao", timestamp: ago(70), isTeamMember: true },
      { author: "Carlos R.", text: "Trabalhando nisso, encontrei algumas inconsistencias na doc. Vou entrar em contato com o LogiMax", timestamp: ago(48), isTeamMember: true },
    ],
  },

  // === P3 - Media ===
  {
    id: "d4", title: "Alteracao de CPF",
    description: "Precisamos da alteracao do CPF da usuaria 88383-ANA GABRIELA BARRIOS AZOCAR para o CPF 001.224.789-83",
    priority: "p3", status: "aberta", demandType: "Tarefa/Ajuda", workflow: "Demanda Suporte", product: "",
    requester: { name: "Igor Daleves", avatar: "" }, assignee: { name: "Hugo", avatar: "" },
    cc: ["Hugo"], createdAt: ago(6), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["cadastro", "cpf"],
    slackChannel: "#cliente-vspay", slackPermalink: "https://slack.com/app/archives/vspay/p4", replies: 2,
    threadReplies: [
      { author: "Igor Daleves", text: "Pode fazer a alteracao do CPF por favor?", timestamp: ago(5.5), isTeamMember: false },
      { author: "Hugo", text: "Igor, ja abri a operacao SQL pra alterar. Segue ajustado, pode verificar no sistema", timestamp: ago(2), isTeamMember: true },
    ],
  },
  {
    id: "d9", title: "Configuracao de novo estabelecimento",
    description: "Cliente Topfarma precisa cadastrar 3 novos estabelecimentos na rede credenciada para aceitar o cartao beneficio.",
    priority: "p3", status: "concluida", demandType: "Tarefa/Ajuda", workflow: "Demanda Suporte", product: "Beneficios",
    requester: { name: "Igor Daleves", avatar: "" }, assignee: { name: "Ana L.", avatar: "" },
    cc: [], createdAt: ago(72), dueDate: null, completedAt: ago(48),
    hasTask: false, taskLink: "", tags: ["cadastro", "rede"],
    slackChannel: "#cliente-kpi", slackPermalink: "https://slack.com/app/archives/kpi/p9", replies: 3,
    threadReplies: [
      { author: "Igor Daleves", text: "Preciso cadastrar 3 novos estabelecimentos", timestamp: ago(71), isTeamMember: false },
      { author: "Ana L.", text: "Igor, os 3 estabelecimentos foram cadastrados com sucesso. Concluido!", timestamp: ago(48), isTeamMember: true },
    ],
  },
  {
    id: "d10", title: "Relatorio de transacoes do mes de marco",
    description: "Necessario gerar relatorio consolidado de todas as transacoes realizadas em marco/2026 para envio ao cliente.",
    priority: "p3", status: "concluida", demandType: "Tarefa/Ajuda", workflow: "Suporte SmartVale", product: "Beneficios",
    requester: { name: "Ster Brito", avatar: "" }, assignee: { name: "Joao P.", avatar: "" },
    cc: [], createdAt: ago(120), dueDate: null, completedAt: ago(96),
    hasTask: false, taskLink: "", tags: ["relatorio", "financeiro"],
    slackChannel: "#cliente-smartvale", slackPermalink: "https://slack.com/app/archives/smartvale/p10", replies: 2,
    threadReplies: [
      { author: "Ster Brito", text: "Preciso do relatorio de marco consolidado", timestamp: ago(119), isTeamMember: false },
      { author: "Joao P.", text: "Ster, segue o relatorio em anexo. Finalizado!", timestamp: ago(96), isTeamMember: true },
    ],
  },
  {
    id: "d15", title: "Exportar base de usuarios ativos",
    description: "Cliente solicitou exportacao da base completa de usuarios ativos com dados de saldo atual para auditoria interna.",
    priority: "p3", status: "aberta", demandType: "Tarefa/Ajuda", workflow: "Demanda Suporte", product: "Beneficios",
    requester: { name: "Ster Brito", avatar: "" }, assignee: { name: "Ana L.", avatar: "" },
    cc: [], createdAt: ago(4), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["dados", "exportacao"],
    slackChannel: "#cliente-smartvale", slackPermalink: "https://slack.com/app/archives/smartvale/p15", replies: 1,
    threadReplies: [],
  },

  // === Sem classificacao ===
  {
    id: "d6", title: "Operacao SQL - Update CPF usuario",
    description: "UPDATE crd_usuario SET crd_usr_cpf = '00122478983' WHERE crd_usr_id = 88383.",
    priority: "sem_classificacao", status: "aberta", demandType: "Update", workflow: "Operacoes SQL", product: "",
    requester: { name: "Hugo", avatar: "" }, assignee: { name: "Tiago Silva", avatar: "" },
    cc: ["Rafael Cursino"], createdAt: ago(0.5), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "https://slack.com/app/archives/C06UJJE47EX/p1775151702947219",
    tags: ["sql", "banco"], slackChannel: "#cliente-vspay",
    slackPermalink: "https://slack.com/app/archives/vspay/p6", replies: 0,
    threadReplies: [],
  },
  {
    id: "d7", title: "Topfarma - Remessa Sitef",
    description: "Solicitacao de remessa Sitef enviada com sucesso. Empresa solicitante: KPI Beneficios.",
    priority: "sem_classificacao", status: "aberta", demandType: "Remessa", workflow: "Remessa Sitef", product: "",
    requester: { name: "Victor Augusto", avatar: "" }, assignee: null,
    cc: [], createdAt: ago(3), dueDate: h(48), completedAt: null,
    hasTask: true, taskLink: "https://slack.com/app/archives/C0702V6FE2E/p1775497313802659",
    tags: ["remessa", "sitef"], slackChannel: "#cliente-kpi",
    slackPermalink: "https://slack.com/app/archives/kpi/p7", replies: 2,
    threadReplies: [
      { author: "Victor Augusto", text: "Remessa enviada, aguardando processamento", timestamp: ago(2.5), isTeamMember: false },
    ],
  },
  {
    id: "d12", title: "Nova remessa TEF - Farma Rede",
    description: "Solicitacao de nova remessa TEF para a rede Farma Rede. Empresa solicitante: KPI Beneficios.",
    priority: "sem_classificacao", status: "concluida", demandType: "Remessa", workflow: "Remessa Sitef", product: "",
    requester: { name: "Victor Augusto", avatar: "" }, assignee: { name: "Joao P.", avatar: "" },
    cc: [], createdAt: ago(144), dueDate: ago(72), completedAt: ago(96),
    hasTask: true, taskLink: "", tags: ["remessa", "sitef"],
    slackChannel: "#cliente-kpi", slackPermalink: "https://slack.com/app/archives/kpi/p12", replies: 1,
    threadReplies: [
      { author: "Joao P.", text: "Remessa processada com sucesso. Concluido!", timestamp: ago(96), isTeamMember: true },
    ],
  },
];

/** Extrai nome do cliente do canal Slack (ex: #cliente-vspay -> Vspay) */
export function extractClientName(channel: string): string {
  const match = channel.match(/#cliente-(.+)/);
  if (!match) return channel;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
