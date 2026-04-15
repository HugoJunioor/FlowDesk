export type DemandPriority = "p1" | "p2" | "p3" | "sem_classificacao";
export type DemandStatus = "aberta" | "em_andamento" | "concluida" | "expirada";
export type DemandType = "Tarefa/Ajuda" | "Problema/Bug" | "Update" | "Remessa" | "Outro";

export type DemandCategory =
  | "Portal do cliente" | "Aplicativo" | "Backoffice" | "Cadastro"
  | "Cartao" | "Carteiras/Produto" | "Faturas" | "KYC"
  | "Transacao" | "Relatorio" | "SMS" | "Conta Tesouro"
  | "Boleto" | "NF" | "Saldo" | "Pagamento" | "";

export type ExpirationReason =
  | "Falta de retorno do cliente" | "Falta de retorno da Just"
  | "Demora para validar a correcao" | "Demora no retorno da Just"
  | "Demora no primeiro atendimento" | "Demora no retorno do cliente"
  | "Demanda fora do escopo" | "Dependencia de terceiros"
  | "Ajuste na prioridade" | "Demanda complexa"
  | "Muitas demandas juntas" | "";

export type SupportLevel = "N1" | "N2" | "N3" | "";

export const CATEGORY_OPTIONS: DemandCategory[] = [
  "Portal do cliente", "Aplicativo", "Backoffice", "Cadastro",
  "Cartao", "Carteiras/Produto", "Faturas", "KYC",
  "Transacao", "Relatorio", "SMS", "Conta Tesouro",
  "Boleto", "NF", "Saldo", "Pagamento",
];

export const EXPIRATION_REASON_OPTIONS: ExpirationReason[] = [
  "Falta de retorno do cliente", "Falta de retorno da Just",
  "Demora para validar a correcao", "Demora no retorno da Just",
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

export interface ThreadReply {
  author: string;
  text: string;
  timestamp: string;
  isTeamMember: boolean;
  hasCheckReaction?: boolean;
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
  expirationReason: ExpirationReason;
  supportLevel: SupportLevel;
  internalComment: string;
  observation?: string;
  attachments?: ClosureAttachment[];
  autoFilled: {
    category: boolean;
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
  dueDate: string | null;
  completedAt: string | null;
  hasTask: boolean;
  taskLink: string;
  tags: string[];
  slackChannel: string;
  slackPermalink: string;
  replies: number;
  threadReplies: ThreadReply[];
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
