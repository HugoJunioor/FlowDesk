import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DemandPriority, PRIORITY_CONFIG } from "@/types/demand";
import { getBusinessTimeInfo, addBusinessHours } from "@/lib/businessHours";

interface ExpirationCountdownProps {
  dueDate: string;
  createdAt: string;
  status: string;
  priority?: DemandPriority;
  compact?: boolean;
  /** completedAt eh usado para detectar se a demanda concluida estourou SLA */
  completedAt?: string | null;
  /** Motivo da expiracao (fd_demand_overrides.closure.expirationReason) */
  expirationReason?: string;
}

const ExpirationCountdown = ({
  dueDate,
  createdAt,
  status,
  priority,
  compact = false,
  completedAt,
  expirationReason,
}: ExpirationCountdownProps) => {
  // Concluida: verifica se estourou SLA (tempo de conclusao > prazo)
  if (status === "concluida") {
    let breachedWhenCompleted = false;
    if (completedAt && priority && priority !== "sem_classificacao") {
      const cfg = PRIORITY_CONFIG[priority];
      if (cfg?.sla) {
        const dueAt = addBusinessHours(new Date(createdAt), cfg.sla.resolutionHours);
        if (new Date(completedAt) > dueAt) breachedWhenCompleted = true;
      }
    }
    if (breachedWhenCompleted) {
      return (
        <div className="flex flex-col gap-0.5">
          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px] w-fit">
            <AlertTriangle size={10} className="mr-1" />
            Concluída fora do SLA
          </Badge>
          {expirationReason && (
            <span className="text-[10px] text-destructive/80 italic">
              Motivo: {expirationReason}
            </span>
          )}
        </div>
      );
    }
    return (
      <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
        <CheckCircle2 size={10} className="mr-1" />
        Concluída
      </Badge>
    );
  }

  // Calculate dueDate from SLA using BUSINESS HOURS
  let effectiveDueDate = dueDate;
  if (!effectiveDueDate && priority && priority !== "sem_classificacao") {
    const config = PRIORITY_CONFIG[priority];
    if (config.sla) {
      const created = new Date(createdAt);
      const businessDue = addBusinessHours(created, config.sla.resolutionHours);
      effectiveDueDate = businessDue.toISOString();
    }
  }

  if (!effectiveDueDate) return null;

  const info = getBusinessTimeInfo(createdAt, effectiveDueDate);

  // SLA expirado: badge sem barra (+ motivo se houver)
  if (info.isExpired || status === "expirada") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px] animate-pulse w-fit">
          <AlertTriangle size={10} className="mr-1" />
          SLA Expirado
        </Badge>
        {expirationReason && (
          <span className="text-[10px] text-destructive/80 italic">
            Motivo: {expirationReason}
          </span>
        )}
      </div>
    );
  }

  const colorClass = info.isCritical
    ? "text-destructive"
    : info.isWarning
    ? "text-warning"
    : "text-success";

  if (compact) {
    return (
      <span className={`text-xs font-medium flex items-center gap-1 ${colorClass}`}>
        <Clock size={12} />
        {info.timeText}
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className={`text-xs font-medium flex items-center gap-1 ${colorClass}`}>
          <Clock size={12} className={info.isCritical ? "animate-pulse" : ""} />
          <span>{info.timeText} restantes</span>
        </div>
        <span className="text-[10px] text-muted-foreground">horario util</span>
      </div>
      <Progress value={info.progress} className="h-1.5" />
    </div>
  );
};

export default ExpirationCountdown;
