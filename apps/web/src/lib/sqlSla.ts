import { SlackDemand } from "@/types/demand";
import { getBusinessMinutesBetween } from "@/lib/businessHours";

/**
 * Utilitarios de SLA do modulo SQL.
 * O tempo de atendimento e calculado de approvedAt (mensagem com "aprovado")
 * ate completedAt, considerando APENAS horario comercial (Seg-Sex 8-18,
 * excluindo feriados).
 */

/** Retorna o timestamp de aprovacao de uma demanda (vem do sync automatico). */
export function getApprovedAt(d: SlackDemand): string | null {
  const typed = d as SlackDemand & { approvedAt?: string };
  return typed.approvedAt || null;
}

/**
 * Tempo de atendimento em minutos UTEIS (horario comercial).
 * Seg-Sex 8h-18h, excluindo feriados. Retorna null se sem aprovacao.
 */
export function getHandlingMinutes(d: SlackDemand): number | null {
  const approved = getApprovedAt(d);
  if (!approved) return null;

  const start = new Date(approved);

  if (d.status === "concluida" && d.completedAt) {
    return getBusinessMinutesBetween(start, new Date(d.completedAt));
  }

  // Em andamento: tempo util decorrido desde a aprovacao
  if (d.status === "em_andamento") {
    return getBusinessMinutesBetween(start, new Date());
  }

  return null;
}

/** Formata minutos uteis como "2d 3h 45min", "4h 30min", "45min" */
export function formatHandlingTime(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "< 1min";
  const MINUTES_PER_DAY = 600; // 10h uteis por dia
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const remAfterDays = minutes % MINUTES_PER_DAY;
  const hours = Math.floor(remAfterDays / 60);
  const mins = remAfterDays % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && days === 0) parts.push(`${mins}min`);
  return parts.length > 0 ? parts.join(" ") : "< 1min";
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
