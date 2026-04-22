import { SlackDemand } from "@/types/demand";

/**
 * Retorna horas desde a ultima interacao (mensagem) na thread.
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

  return (Date.now() - lastTs) / 3600000;
}

/** Retorna true se a demanda estiver sem interacao ha mais de 24h */
export function isStale(d: SlackDemand, thresholdHours = 24): boolean {
  const hrs = getHoursSinceLastInteraction(d);
  return hrs !== null && hrs > thresholdHours;
}

/** Formata horas como "26h", "2d" ou "5d 3h" */
export function formatStaleTime(hours: number): string {
  const days = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  if (days === 0) return `${h}h`;
  if (h === 0) return `${days}d`;
  return `${days}d ${h}h`;
}
