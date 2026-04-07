import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink, Building2, MessageCircle, Clock, Info, Sparkles } from "lucide-react";
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
        {/* Header: title + info icon + assignee avatar */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {demand.title}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{demand.workflow}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Info icon with classification popover */}
            {demand.autoClassification && (() => {
              const wasReclassified = demand.autoClassification!.reason.startsWith("Reclassificado");
              return (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`p-1 rounded-md hover:bg-muted transition-colors ${
                      wasReclassified ? "text-warning animate-pulse" : "text-muted-foreground hover:text-primary"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {wasReclassified ? <Sparkles size={14} /> : <Info size={14} />}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-72 p-3"
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-primary" />
                      <span className="text-xs font-semibold text-primary">Classificacao automatica</span>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] ${PRIORITY_CONFIG[demand.autoClassification.priority].bg} ${PRIORITY_CONFIG[demand.autoClassification.priority].color}`}>
                      {PRIORITY_CONFIG[demand.autoClassification.priority].label}
                    </Badge>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {demand.autoClassification.reason}
                    </p>
                    {demand.autoClassification.matchedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {demand.autoClassification.matchedKeywords.slice(0, 4).map((kw) => (
                          <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 pt-1 border-t border-border">
                      <span className="text-[10px] text-muted-foreground">Confianca:</span>
                      <span className={`text-[10px] font-medium ${
                        demand.autoClassification.confidence === "alta" ? "text-success" :
                        demand.autoClassification.confidence === "media" ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {demand.autoClassification.confidence}
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              );
            })()}
            {demand.assignee && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                {demand.assignee.name.split(" ").map((n) => n[0]).join("")}
              </div>
            )}
          </div>
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

        {/* Last team reply */}
        {demand.lastTeamReply && (
          <div className="mt-2 p-2 rounded bg-muted/40 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{demand.lastTeamReply.author}:</span>{" "}
            <span className="line-clamp-1">{demand.lastTeamReply.text}</span>
          </div>
        )}

        {/* Badges: status + priority + type */}
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className={`text-[10px] ${status.bg} ${status.color}`}>
              {status.label}
            </Badge>
            {demand.statusAnalysis && !demand.manualStatusOverride && (
              <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary">
                Auto
              </Badge>
            )}
            {demand.priority !== "sem_classificacao" && (
              <Badge variant="secondary" className={`text-[10px] ${priority.bg} ${priority.color}`}>
                {priority.shortLabel}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {demand.demandType}
            </Badge>
          </div>

          {/* Countdown */}
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
