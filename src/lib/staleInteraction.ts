import { SlackDemand } from "@/types/demand";
import { getBusinessMinutesBetween } from "@/lib/businessHours";

/**
 * Retorna horas UTEIS desde a ultima interacao (mensagem) na thread.
 * Considera apenas Seg-Sex 8h-18h, descontando feriados e fins de semana.
 *
 * Se nao houver replies, usa createdAt. Retorna null para demandas
 * concluidas/expiradas (nao aplicavel).
 */
export function getHoursSinceLastInteraction(d: SlackDemand): number | null {
  if (d.status === "concluida" || d.status === "expirada") return null;

  const replies = d.threadReplies || [];
  const lastTs =
    replies.length > 0
      ? Math.max(...replies.map((r) => new Date(r.timestamp).getTime()))
      : new Date(d.createdAt).getTime();

  const businessMinutes = getBusinessMinutesBetween(new Date(lastTs), new Date());
  return businessMinutes / 60;
}

/** Retorna true se a demanda estiver sem interacao ha mais de N horas uteis */
export function isStale(d: SlackDemand, thresholdHours = 24): boolean {
  const hrs = getHoursSinceLastInteraction(d);
  return hrs !== null && hrs > thresholdHours;
}

/**
 * Formata horas uteis em texto curto.
 * Considera 1 dia util = 10 horas uteis (8h-18h).
 *   < 1h    = "Xmin"
 *   < 10h   = "Xh"
 *   >= 10h  = "Xd Yh" (Xd = dias uteis, Yh = horas uteis restantes)
 */
export function formatStaleTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const HOURS_PER_DAY = 10;
  const days = Math.floor(hours / HOURS_PER_DAY);
  const h = Math.floor(hours % HOURS_PER_DAY);
  if (days === 0) return `${h}h`;
  if (h === 0) return `${days}d`;
  return `${days}d ${h}h`;
}
