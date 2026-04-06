import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Building2, MessageCircle, Clock } from "lucide-react";
import { SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG } from "@/types/demand";
import { extractClientName } from "@/data/mockDemands";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ExpirationCountdown from "./ExpirationCountdown";

interface DemandCardProps {
  demand: SlackDemand;
  onClick?: () => void;
}

const DemandCard = ({ demand, onClick }: DemandCardProps) => {
  const priority = PRIORITY_CONFIG[demand.priority];
  const status = STATUS_CONFIG[demand.status];
  const client = extractClientName(demand.slackChannel);

  return (
    <Card
      className={`border border-border shadow-sm hover:shadow-md transition-all cursor-pointer border-l-[3px] ${priority.border}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: title + assignee avatar */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {demand.title}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{demand.workflow}</p>
          </div>
          {demand.assignee && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
              {demand.assignee.name.split(" ").map((n) => n[0]).join("")}
            </div>
          )}
        </div>

        {/* Client + date */}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-0.5 text-primary/80 font-medium">
            <Building2 size={10} />
            {client}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock size={10} />
            {format(new Date(demand.createdAt), "dd/MM HH:mm", { locale: ptBR })}
          </span>
          {demand.replies > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle size={10} />
              {demand.replies}
            </span>
          )}
        </div>

        {/* Badges: status + priority + type */}
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className={`text-[10px] ${status.bg} ${status.color}`}>
              {status.label}
            </Badge>
            {demand.priority !== "sem_classificacao" && (
              <Badge variant="secondary" className={`text-[10px] ${priority.bg} ${priority.color}`}>
                {priority.shortLabel}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {demand.demandType}
            </Badge>
          </div>

          {/* Countdown - only if has SLA */}
          {demand.priority !== "sem_classificacao" && demand.status !== "concluida" && demand.status !== "expirada" && (
            <ExpirationCountdown
              dueDate={demand.dueDate || ""}
              createdAt={demand.createdAt}
              status={demand.status}
              priority={demand.priority}
            />
          )}
        </div>

        {/* Footer: assignee + slack link */}
        <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
          <span>{demand.assignee?.name || "Sem responsavel"}</span>
          <a
            href={demand.slackPermalink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 hover:text-primary transition-colors"
          >
            <ExternalLink size={10} />
            Slack
          </a>
        </div>
      </CardContent>
    </Card>
  );
};

export default DemandCard;
