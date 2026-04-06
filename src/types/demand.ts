export type DemandPriority = "p1" | "p2" | "p3";
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
} as const;

export const STATUS_CONFIG = {
  aberta: { label: "Aberta", color: "text-warning", bg: "bg-warning/10" },
  em_andamento: { label: "Em andamento", color: "text-info", bg: "bg-info/10" },
  concluida: { label: "Concluida", color: "text-success", bg: "bg-success/10" },
  expirada: { label: "Expirada", color: "text-destructive", bg: "bg-destructive/10" },
} as const;
