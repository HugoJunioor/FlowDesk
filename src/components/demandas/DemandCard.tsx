import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Hash } from "lucide-react";
import { SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG } from "@/types/demand";
import ExpirationCountdown from "./ExpirationCountdown";

interface DemandCardProps {
  demand: SlackDemand;
  onClick?: () => void;
}

const DemandCard = ({ demand, onClick }: DemandCardProps) => {
  const priority = PRIORITY_CONFIG[demand.priority];
  const status = STATUS_CONFIG[demand.status];

  return (
    <Card
      className={`border border-border shadow-sm hover:shadow-md transition-all cursor-pointer border-l-[3px] ${priority.border}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: priority badge + assignee */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {demand.title}
            </h3>
          </div>
          {demand.assignee && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
              {demand.assignee.name.split(" ").map((n) => n[0]).join("")}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {demand.tags.map((tag) => (
            <span key={tag} className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Hash size={9} />
              {tag}
            </span>
          ))}
        </div>

        {/* Footer: status + countdown */}
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className={`text-[10px] ${status.bg} ${status.color}`}>
              {status.label}
            </Badge>
            <Badge variant="secondary" className={`text-[10px] ${priority.bg} ${priority.color}`}>
              {priority.label}
            </Badge>
          </div>

          <ExpirationCountdown
            dueDate={demand.dueDate}
            createdAt={demand.createdAt}
            status={demand.status}
          />
        </div>

        {/* Assignee + channel */}
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
