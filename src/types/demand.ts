export type DemandPriority = "p1" | "p2" | "p3" | "sem_classificacao";
export type DemandStatus = "aberta" | "em_andamento" | "concluida" | "expirada";
export type DemandType =
  | "Tarefa/Ajuda" | "Problema/Bug" | "Update" | "Remessa"
  | "Sitef" | "Conciliacao"
  | "Outro";

export type DemandCategory =
  | "Portal do cliente" | "Aplicativo" | "Backoffice" | "Cadastro"
  | "Cartao" | "Carteiras/Produto" | "Faturas" | "KYC"
  | "Transacao" | "Relatorio" | "SMS" | "Conta Tesouro"
  | "Boleto" | "NF" | "Saldo" | "Pagamento"
  | "Inclusao de Rede" | "Criacao de Nova Conciliacao" | "Sitef"
  | "";

export type ExpirationReason =
  | "Falta de retorno do cliente" | "Falta de retorno da equipe"
  | "Demora para validar a correcao" | "Demora no retorno da equipe"
  | "Demora no primeiro atendimento" | "Demora no retorno do cliente"
  | "Demanda fora do escopo" | "Dependencia de terceiros"
  | "Ajuste na prioridade" | "Demanda complexa"
  | "Muitas demandas juntas" | "";

export type SupportLevel = "N1" | "N2" | "N3" | "";

/**
 * Motivo de contato — taxonomia derivada da analise de demandas de abril/26.
 * Diferente de DemandCategory (area/produto), este eh o "porque" do contato
 * (o que estah quebrado / o que o cliente precisa). Classificado por IA via
 * classifyContactReason em closureClassifier.
 */
export type ContactReason =
  | "Saldo Nao Creditado / Pagamento Nao Compensado"
  | "Falha na Vinculacao / Uso de Cartao"
  | "Duvida / Solicitacao Interna / Outros"
  | "Estorno / Reembolso / Cancelamento de Transacao"
  | "Problema com PIX"
  | "Ajuste de Dados Cadastrais (CPF / Nome)"
  | "Bug em Importacao / Relatorio de Abastecimento"
  | "Erro Fiscal (NF, Boleto, RPS, DANFE)"
  | "Solicitacao de Relatorio / Extrato"
  | "Retirada / Transferencia de Saldo"
  | "Problema de Conciliacao / Layout de Arquivo"
  | "Cadastro Duplicado / Exclusao"
  | "Erro de Acesso (App, Portal, Senha)"
  | "Lentidao / Instabilidade de Sistema"
  | "Solicitacao / Gestao de Acesso e Permissoes"
  | "Falha no Envio de Token / E-mail"
  | "Erro em Abastecimento / Autorizacao"
  | "Bug / Erro de Sistema (Outros)"
  | "Falha no Saque (24h / ATM)"
  | "KYC Reprovado / Falha de Identidade"
  | "Erro em Fechamento de Periodo / Faturamento"
  | "";

export const CONTACT_REASON_OPTIONS: ContactReason[] = [
  "Saldo Nao Creditado / Pagamento Nao Compensado",
  "Falha na Vinculacao / Uso de Cartao",
  "Duvida / Solicitacao Interna / Outros",
  "Estorno / Reembolso / Cancelamento de Transacao",
  "Problema com PIX",
  "Ajuste de Dados Cadastrais (CPF / Nome)",
  "Bug em Importacao / Relatorio de Abastecimento",
  "Erro Fiscal (NF, Boleto, RPS, DANFE)",
  "Solicitacao de Relatorio / Extrato",
  "Retirada / Transferencia de Saldo",
  "Problema de Conciliacao / Layout de Arquivo",
  "Cadastro Duplicado / Exclusao",
  "Erro de Acesso (App, Portal, Senha)",
  "Lentidao / Instabilidade de Sistema",
  "Solicitacao / Gestao de Acesso e Permissoes",
  "Falha no Envio de Token / E-mail",
  "Erro em Abastecimento / Autorizacao",
  "Bug / Erro de Sistema (Outros)",
  "Falha no Saque (24h / ATM)",
  "KYC Reprovado / Falha de Identidade",
  "Erro em Fechamento de Periodo / Faturamento",
];

export const CATEGORY_OPTIONS: DemandCategory[] = [
  "Portal do cliente", "Aplicativo", "Backoffice", "Cadastro",
  "Cartao", "Carteiras/Produto", "Faturas", "KYC",
  "Transacao", "Relatorio", "SMS", "Conta Tesouro",
  "Boleto", "NF", "Saldo", "Pagamento",
  "Inclusao de Rede", "Criacao de Nova Conciliacao", "Sitef",
];

export const EXPIRATION_REASON_OPTIONS: ExpirationReason[] = [
  "Falta de retorno do cliente", "Falta de retorno da equipe",
  "Demora para validar a correcao", "Demora no retorno da equipe",
  "Demora no primeiro atendimento", "Demora no retorno do cliente",
  "Demanda fora do escopo", "Dependencia de terceiros",
  "Ajuste na prioridade", "Demanda complexa",
  "Muitas demandas juntas",
];

export const SUPPORT_LEVEL_OPTIONS: SupportLevel[] = ["N1", "N2", "N3"];

// Mapeamento de membros da equipe por nível de suporte
// Configurar via localStorage key "fd_support_members" ou editar localmente
function loadSupportMembers(): Record<string, SupportLevel> {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("fd_support_members") : null;
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

export const SUPPORT_LEVEL_MEMBERS: Record<string, SupportLevel> = loadSupportMembers();

export interface SlackUser {
  name: string;
  avatar: string;
}

/** Arquivo anexado a uma mensagem Slack (msg.files[i] da API). */
export interface SlackFile {
  /** ID do file no Slack (ex: F12345ABC) */
  id: string;
  /** Nome original */
  name: string;
  /** MIME type (ex: image/png, application/pdf) */
  mimetype: string;
  /** Tamanho em bytes */
  size: number;
  /** URL privada (precisa de token Bot pra acessar) */
  urlPrivate?: string;
  /** Thumbnail 360px (imagens) — geralmente publica */
  thumb360?: string;
  /** Preview text (truncated) — pra docs/code snippets */
  preview?: string;
  /** Pode ser baixado direto sem auth (raro mas acontece) */
  isPublic?: boolean;
}

export interface ThreadReply {
  author: string;
  text: string;
  timestamp: string;
  isTeamMember: boolean;
  hasCheckReaction?: boolean;
  /**
   * True se essa reply recebeu reaction de :loading: (ou equivalente).
   * Usado pra marcar inicio de atendimento em demandas Sitef/Conciliacao.
   */
  hasLoadingReaction?: boolean;
  /** Arquivos anexados nessa reply */
  files?: SlackFile[];
}

export interface ClosureAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  addedAt: string;
}

export interface ClosureFields {
  category: DemandCategory;
  /** Motivo de contato (porque o cliente abriu) — classificado por IA */
  contactReason?: ContactReason;
  expirationReason: ExpirationReason;
  supportLevel: SupportLevel;
  internalComment: string;
  observation?: string;
  attachments?: ClosureAttachment[];
  autoFilled: {
    category: boolean;
    contactReason?: boolean;
    expirationReason: boolean;
    supportLevel: boolean;
  };
}

export interface SlackDemand {
  id: string;
  title: string;
  description: string;
  priority: DemandPriority;
  status: DemandStatus;
  demandType: DemandType;
  workflow: string;
  product: string;
  requester: SlackUser;
  assignee: SlackUser | null;
  cc: string[];
  createdAt: string;
  /**
   * Timestamp em que o atendimento foi iniciado (apenas Sitef/Conciliacao).
   * Definido pelo sync quando alguem reage com :loading: em alguma reply.
   * NULL = atendimento ainda nao iniciado.
   */
  serviceStartedAt?: string | null;
  dueDate: string | null;
  completedAt: string | null;
  hasTask: boolean;
  taskLink: string;
  tags: string[];
  slackChannel: string;
  slackPermalink: string;
  replies: number;
  threadReplies: ThreadReply[];
  /** Arquivos anexados na mensagem original (raiz da thread) */
  files?: SlackFile[];
  lastTeamReply?: {
    author: string;
    text: string;
    timestamp: string;
  };
  statusAnalysis?: {
    suggestedStatus: DemandStatus;
    reason: string;
    confidence: "alta" | "media" | "baixa";
    detectedAt: string;
  };
  manualStatusOverride?: boolean;
  slaFirstResponse?: number | null;
  slaStatus?: string | null;
  slaResolutionStatus?: string | null;
  resolutionHours?: number | null;
  expirationReason?: string | null;
  autoClassification?: {
    priority: DemandPriority;
    confidence: "alta" | "media" | "baixa";
    reason: string;
    matchedKeywords: string[];
  };
  closure?: ClosureFields;
}

export const PRIORITY_CONFIG = {
  p1: {
    label: "P1 - Critico",
    shortLabel: "P1",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-l-destructive",
    sla: { response: "15 min", resolution: "4 horas", resolutionHours: 4 },
  },
  p2: {
    label: "P2 - Alta",
    shortLabel: "P2",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-l-warning",
    sla: { response: "1 hora", resolution: "8 horas", resolutionHours: 8 },
  },
  p3: {
    label: "P3 - Media",
    shortLabel: "P3",
    color: "text-info",
    bg: "bg-info/10",
    border: "border-l-info",
    sla: { response: "4 horas", resolution: "24 horas", resolutionHours: 24 },
  },
  sem_classificacao: {
    label: "Sem classificacao",
    shortLabel: "—",
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-l-muted-foreground",
    sla: null,
  },
} as const;

export const STATUS_CONFIG = {
  aberta: { label: "Aberta", color: "text-warning", bg: "bg-warning/10" },
  em_andamento: { label: "Em andamento", color: "text-info", bg: "bg-info/10" },
  concluida: { label: "Concluida", color: "text-success", bg: "bg-success/10" },
  expirada: { label: "Expirada", color: "text-destructive", bg: "bg-destructive/10" },
} as const;
