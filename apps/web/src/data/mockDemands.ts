import { SlackDemand } from "@/types/demand";

/**
 * Dados de demonstracao genericos.
 * Em producao, os dados reais ficam em realDemands.ts (ignorado no Git).
 * O sistema carrega realDemands se existir, senao usa este mock.
 */

const now = new Date();
const h = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString();
const ago = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

export const mockDemands: SlackDemand[] = [
  {
    id: "demo_1",
    title: "Sistema de producao indisponivel",
    description: "O sistema principal esta fora do ar, impactando toda a operacao. Nenhum usuario consegue acessar.",
    priority: "p1", status: "em_andamento", demandType: "Problema/Bug",
    workflow: "Suporte", product: "Plataforma",
    requester: { name: "Maria Silva", avatar: "" },
    assignee: { name: "Carlos Tech", avatar: "" },
    cc: ["Carlos Tech"], createdAt: ago(2), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["infraestrutura"],
    slackChannel: "#cliente-exemplo", slackPermalink: "#", replies: 3,
    threadReplies: [
      { author: "Maria Silva", text: "Urgente! Sistema fora do ar", timestamp: ago(1.8), isTeamMember: false },
      { author: "Carlos Tech", text: "Estamos analisando o problema, ja identificamos a causa", timestamp: ago(1.5), isTeamMember: true },
      { author: "Carlos Tech", text: "Problema corrigido, pode verificar o acesso", timestamp: ago(0.5), isTeamMember: true },
    ],
  },
  {
    id: "demo_2",
    title: "Erro no calculo de impostos",
    description: "Modulo de faturamento retornando valores incorretos para notas fiscais de servico.",
    priority: "p2", status: "aberta", demandType: "Problema/Bug",
    workflow: "Suporte", product: "Financeiro",
    requester: { name: "Ana Financeiro", avatar: "" },
    assignee: { name: "Pedro Dev", avatar: "" },
    cc: [], createdAt: ago(3), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["financeiro", "bug"],
    slackChannel: "#cliente-demo", slackPermalink: "#", replies: 1,
    threadReplies: [
      { author: "Ana Financeiro", text: "Os valores estao divergentes desde ontem", timestamp: ago(2.5), isTeamMember: false },
    ],
  },
  {
    id: "demo_3",
    title: "Alteracao de dados cadastrais",
    description: "Necessario atualizar o CPF do usuario 12345 conforme solicitacao.",
    priority: "p3", status: "concluida", demandType: "Tarefa/Ajuda",
    workflow: "Demanda Suporte", product: "",
    requester: { name: "Julia Suporte", avatar: "" },
    assignee: { name: "Carlos Tech", avatar: "" },
    cc: [], createdAt: ago(24), dueDate: null, completedAt: ago(20),
    hasTask: false, taskLink: "", tags: ["cadastro"],
    slackChannel: "#cliente-exemplo", slackPermalink: "#", replies: 2,
    threadReplies: [
      { author: "Julia Suporte", text: "Pode fazer a alteracao por favor?", timestamp: ago(23), isTeamMember: false },
      { author: "Carlos Tech", text: "Feito! Dados atualizados com sucesso", timestamp: ago(20), isTeamMember: true },
    ],
  },
  {
    id: "demo_4",
    title: "Lentidao no portal do cliente",
    description: "Portal esta com tempos de resposta acima de 10 segundos. Clientes reclamando.",
    priority: "p2", status: "em_andamento", demandType: "Problema/Bug",
    workflow: "Suporte", product: "Portal",
    requester: { name: "Roberto Atendimento", avatar: "" },
    assignee: { name: "Pedro Dev", avatar: "" },
    cc: ["Carlos Tech"], createdAt: ago(5), dueDate: null, completedAt: null,
    hasTask: true, taskLink: "", tags: ["performance"],
    slackChannel: "#cliente-demo", slackPermalink: "#", replies: 4,
    threadReplies: [
      { author: "Roberto Atendimento", text: "Clientes reclamando de lentidao", timestamp: ago(4.5), isTeamMember: false },
      { author: "Pedro Dev", text: "Estamos investigando, parece ser o banco de dados", timestamp: ago(4), isTeamMember: true },
      { author: "Pedro Dev", text: "Vou criar a task no ClickUp para o time de infra", timestamp: ago(3), isTeamMember: true },
    ],
  },
  {
    id: "demo_5",
    title: "Exportar relatorio mensal",
    description: "Gerar relatorio consolidado de transacoes do mes anterior para envio ao cliente.",
    priority: "p3", status: "aberta", demandType: "Tarefa/Ajuda",
    workflow: "Demanda Suporte", product: "Relatorios",
    requester: { name: "Fernanda Comercial", avatar: "" },
    assignee: null,
    cc: [], createdAt: ago(4), dueDate: null, completedAt: null,
    hasTask: false, taskLink: "", tags: ["relatorio"],
    slackChannel: "#cliente-exemplo", slackPermalink: "#", replies: 0,
    threadReplies: [],
  },
  {
    id: "demo_6",
    title: "Operacao SQL - Correcao de registro",
    description: "UPDATE tabela SET campo = 'valor' WHERE id = 123",
    priority: "sem_classificacao", status: "concluida", demandType: "Update",
    workflow: "Operacoes SQL", product: "",
    requester: { name: "Carlos Tech", avatar: "" },
    assignee: { name: "DBA", avatar: "" },
    cc: [], createdAt: ago(12), dueDate: null, completedAt: ago(10),
    hasTask: false, taskLink: "", tags: ["sql"],
    slackChannel: "#cliente-demo", slackPermalink: "#", replies: 1,
    threadReplies: [
      { author: "DBA", text: "Executado com sucesso!", timestamp: ago(10), isTeamMember: true },
    ],
  },
];

/** Extrai nome do cliente do canal Slack (ex: #cliente-acme -> Acme) */
export function extractClientName(channel: string): string {
  const match = channel.match(/#cliente-(.+)/);
  if (!match) return channel;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
