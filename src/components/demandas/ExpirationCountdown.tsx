import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle } from "lucide-react";
import { getBusinessTimeInfo } from "@/lib/businessHours";

interface ExpirationCountdownProps {
  dueDate: string;
  createdAt: string;
  status: string;
  compact?: boolean;
}

const ExpirationCountdown = ({ dueDate, createdAt, status, compact = false }: ExpirationCountdownProps) => {
  if (status === "concluida") {
    return (
      <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
        Concluida
      </Badge>
    );
  }

  const info = getBusinessTimeInfo(createdAt, dueDate);

  if (info.isExpired || status === "expirada") {
    return (
      <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px] animate-pulse">
        <AlertTriangle size={10} className="mr-1" />
        SLA Expirado
      </Badge>
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
