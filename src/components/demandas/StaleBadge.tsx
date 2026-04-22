import { AlertCircle } from "lucide-react";
import { SlackDemand } from "@/types/demand";
import {
  getHoursSinceLastInteraction,
  formatStaleTime,
} from "@/lib/staleInteraction";

interface StaleBadgeProps {
  demand: SlackDemand;
  /** Limite em horas para considerar "sem interacao". Default: 24h */
  thresholdHours?: number;
  /** Forma compacta (so numero + unidade), sem rotulo */
  compact?: boolean;
  className?: string;
}

/**
 * Badge piscante em vermelho mostrando tempo sem interacao.
 * Aparece apenas se a demanda estiver aberta/em_andamento e ultrapassar
 * o limite (default 24h).
 */
const StaleBadge = ({
  demand,
  thresholdHours = 24,
  compact = false,
  className = "",
}: StaleBadgeProps) => {
  const hours = getHoursSinceLastInteraction(demand);
  if (hours === null || hours <= thresholdHours) return null;

  const label = formatStaleTime(hours);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive border border-destructive/30 animate-pulse shrink-0 ${className}`}
      title={`Sem interação há ${label}`}
    >
      <AlertCircle size={10} />
      {compact ? label : `${label} sem interação`}
    </span>
  );
};

export default StaleBadge;
