import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Hash, User, Calendar, Clock, MessageSquare, UserCog, Building2, Layers, Package, MessageCircle, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG } from "@/types/demand";
import { extractClientName } from "@/data/mockDemands";
import ExpirationCountdown from "./ExpirationCountdown";

interface DemandDetailSheetProps {
  demand: SlackDemand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: string[];
  onAssigneeChange: (demandId: string, assignee: string | null) => void;
  onStatusChange: (demandId: string, status: string) => void;
}

const DemandDetailSheet = ({ demand, open, onOpenChange, assignees, onAssigneeChange, onStatusChange }: DemandDetailSheetProps) => {
  if (!demand) return null;

  const priority = PRIORITY_CONFIG[demand.priority];
  const status = STATUS_CONFIG[demand.status];
  const client = extractClientName(demand.slackChannel);

  const formatDate = (iso: string) =>
    format(new Date(iso), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={`text-[10px] ${priority.bg} ${priority.color}`}>
              {priority.label}
            </Badge>
            <Badge variant="secondary" className={`text-[10px] ${status.bg} ${status.color}`}>
              {status.label}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {demand.demandType}
            </Badge>
          </div>
          <SheetTitle className="text-lg leading-snug mt-2">
            {demand.title}
          </SheetTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-primary/80 font-medium">
              <Building2 size={12} /> {client}
            </span>
            <span className="flex items-center gap-1">
              <Layers size={12} /> {demand.workflow}
            </span>
          </div>
        </SheetHeader>

        <div className="space-y-5">
          {/* Countdown - only if has SLA */}
          {demand.priority !== "sem_classificacao" && demand.status !== "concluida" && (
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Tempo restante (horario util)</p>
              <ExpirationCountdown
                dueDate={demand.dueDate || ""}
                createdAt={demand.createdAt}
                status={demand.status}
                priority={demand.priority}
              />
            </div>
          )}

          {/* Responsavel - editavel */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <UserCog size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Responsavel</p>
            </div>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={demand.assignee?.name || ""}
              onChange={(e) => onAssigneeChange(demand.id, e.target.value || null)}
            >
              <option value="">Sem responsavel</option>
              {assignees.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Status - editavel */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Status</p>
            </div>
            <select
              className={`w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-medium ${status.color}`}
              value={demand.status}
              onChange={(e) => onStatusChange(demand.id, e.target.value)}
            >
              <option value="aberta">Aberta</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluida</option>
              <option value="expirada">Expirada</option>
            </select>
          </div>

          {/* Descricao */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1.5">Descricao</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{demand.description}</p>
          </div>

          <Separator />

          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MessageSquare size={12} /> Solicitante
              </p>
              <p className="text-sm font-medium text-foreground">{demand.requester.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={12} /> Aberto em
              </p>
              <p className="text-sm font-medium text-foreground">{formatDate(demand.createdAt)}</p>
            </div>
            {demand.product && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Package size={12} /> Produto
                </p>
                <p className="text-sm font-medium text-foreground">{demand.product}</p>
              </div>
            )}
            {demand.dueDate && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={12} /> Data limite
                </p>
                <p className="text-sm font-medium text-foreground">{formatDate(demand.dueDate)}</p>
              </div>
            )}
            {demand.replies > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageCircle size={12} /> Respostas
                </p>
                <p className="text-sm font-medium text-foreground">{demand.replies}</p>
              </div>
            )}
            {demand.cc.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User size={12} /> CC
                </p>
                <p className="text-sm font-medium text-foreground">{demand.cc.join(", ")}</p>
              </div>
            )}
          </div>

          {demand.completedAt && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Concluido em</p>
              <p className="text-sm font-medium text-success">{formatDate(demand.completedAt)}</p>
            </div>
          )}

          <Separator />

          {/* SLA - only if classified */}
          {demand.priority !== "sem_classificacao" && priority.sla && (
            <>
              <div className="p-4 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground font-medium mb-3">SLA - {priority.label}</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Resposta</p>
                    <p className="text-sm font-semibold text-foreground">{priority.sla.response}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Resolucao</p>
                    <p className="text-sm font-semibold text-foreground">{priority.sla.resolution}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horario</p>
                    <p className="text-sm font-semibold text-foreground">Seg-Sex 8-18h</p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Task link */}
          {demand.hasTask && demand.taskLink && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Link2 size={14} className="text-muted-foreground" />
              <a
                href={demand.taskLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline truncate"
              >
                Task vinculada
              </a>
            </div>
          )}

          {/* Tags */}
          {demand.tags.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {demand.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px]">
                    <Hash size={10} className="mr-0.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Canal + link */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-xs text-muted-foreground">
              Canal: <span className="font-medium text-foreground">{demand.slackChannel}</span>
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
              <a href={demand.slackPermalink} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={12} />
                Abrir no Slack
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DemandDetailSheet;
