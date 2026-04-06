export type DemandPriority = "urgente" | "alta" | "media" | "baixa";
export type DemandStatus = "aberta" | "em_andamento" | "concluida" | "expirada";

export interface SlackUser {
  name: string;
  avatar: string;
}

export interface SlackDemand {
  id: string;
  title: string;
  description: string;
  priority: DemandPriority;
  status: DemandStatus;
  requester: SlackUser;
  assignee: SlackUser | null;
  createdAt: string;
  dueDate: string;
  completedAt: string | null;
  tags: string[];
  slackChannel: string;
  slackPermalink: string;
}

export const PRIORITY_CONFIG = {
  urgente: { label: "Urgente", color: "text-destructive", bg: "bg-destructive/10", border: "border-l-destructive" },
  alta: { label: "Alta", color: "text-warning", bg: "bg-warning/10", border: "border-l-warning" },
  media: { label: "Media", color: "text-info", bg: "bg-info/10", border: "border-l-info" },
  baixa: { label: "Baixa", color: "text-muted-foreground", bg: "bg-muted", border: "border-l-muted-foreground" },
} as const;

export const STATUS_CONFIG = {
  aberta: { label: "Aberta", color: "text-warning", bg: "bg-warning/10" },
  em_andamento: { label: "Em andamento", color: "text-info", bg: "bg-info/10" },
  concluida: { label: "Concluida", color: "text-success", bg: "bg-success/10" },
  expirada: { label: "Expirada", color: "text-destructive", bg: "bg-destructive/10" },
} as const;
