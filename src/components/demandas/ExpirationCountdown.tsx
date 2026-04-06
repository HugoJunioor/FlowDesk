import { differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle } from "lucide-react";

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

  const now = new Date();
  const due = new Date(dueDate);
  const created = new Date(createdAt);
  const totalMinutes = differenceInMinutes(due, created);
  const elapsedMinutes = differenceInMinutes(now, created);
  const progress = Math.min(100, Math.max(0, (elapsedMinutes / totalMinutes) * 100));

  const minutesLeft = differenceInMinutes(due, now);
  const hoursLeft = differenceInHours(due, now);
  const daysLeft = differenceInDays(due, now);

  const isExpired = minutesLeft <= 0;
  const isCritical = !isExpired && hoursLeft < 4;
  const isWarning = !isExpired && !isCritical && hoursLeft < 24;

  if (isExpired || status === "expirada") {
    return (
      <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px] animate-pulse">
        <AlertTriangle size={10} className="mr-1" />
        Expirada
      </Badge>
    );
  }

  const timeText =
    daysLeft > 0
      ? `${daysLeft}d ${hoursLeft % 24}h`
      : hoursLeft > 0
      ? `${hoursLeft}h ${minutesLeft % 60}m`
      : `${minutesLeft}m`;

  const colorClass = isCritical
    ? "text-destructive"
    : isWarning
    ? "text-warning"
    : "text-success";

  if (compact) {
    return (
      <span className={`text-xs font-medium flex items-center gap-1 ${colorClass}`}>
        <Clock size={12} />
        {timeText}
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className={`text-xs font-medium flex items-center gap-1 ${colorClass}`}>
        <Clock size={12} className={isCritical ? "animate-pulse" : ""} />
        <span>{timeText} restantes</span>
      </div>
      <Progress
        value={progress}
        className="h-1.5"
      />
    </div>
  );
};

export default ExpirationCountdown;
