import { SlackDemand } from "@/types/demand";

/**
 * Utilitarios de SLA do modulo SQL.
 * O tempo de atendimento e calculado de approvedAt (primeira resposta da equipe
 * ou aprovacao manual via botao) ate completedAt.
 */

/** Retorna o timestamp de aprovacao de uma demanda.
 *  Prioridade: override manual > primeira resposta da equipe > null */
export function getApprovedAt(d: SlackDemand): string | null {
  // Override manual (botao "Aprovar") tem prioridade
  if ((d as SlackDemand & { approvedAt?: string }).approvedAt) {
    return (d as SlackDemand & { approvedAt?: string }).approvedAt || null;
  }
  // Primeira resposta da equipe na thread
  const replies = d.threadReplies || [];
  const firstTeamReply = replies
    .filter((r) => r.isTeamMember)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
  return firstTeamReply?.timestamp || null;
}

/** Tempo de atendimento em minutos. Retorna null se nao aplicavel. */
export function getHandlingMinutes(d: SlackDemand): number | null {
  const approved = getApprovedAt(d);
  if (!approved) return null;

  if (d.status === "concluida" && d.completedAt) {
    const ms = new Date(d.completedAt).getTime() - new Date(approved).getTime();
    return Math.max(0, Math.round(ms / 60000));
  }

  // Em andamento: tempo decorrido desde a aprovacao
  if (d.status === "em_andamento") {
    const ms = Date.now() - new Date(approved).getTime();
    return Math.max(0, Math.round(ms / 60000));
  }

  return null;
}

/** Formata minutos como "2h 30min", "1d 4h", "45min" */
export function formatHandlingTime(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "< 1min";
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/** Media de tempo de atendimento das demandas concluidas (em minutos) */
export function getAverageHandlingMinutes(demands: SlackDemand[]): number | null {
  const times: number[] = [];
  for (const d of demands) {
    if (d.status !== "concluida") continue;
    const mins = getHandlingMinutes(d);
    if (mins !== null) times.push(mins);
  }
  if (times.length === 0) return null;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

/** Media de tempo decorrido desde aprovacao para demandas em_andamento */
export function getAverageInProgressMinutes(demands: SlackDemand[]): number | null {
  const times: number[] = [];
  for (const d of demands) {
    if (d.status !== "em_andamento") continue;
    const mins = getHandlingMinutes(d);
    if (mins !== null) times.push(mins);
  }
  if (times.length === 0) return null;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}
