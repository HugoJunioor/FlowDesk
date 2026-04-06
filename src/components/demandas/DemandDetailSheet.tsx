import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Hash, User, Calendar, Clock, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG } from "@/types/demand";
import ExpirationCountdown from "./ExpirationCountdown";

interface DemandDetailSheetProps {
  demand: SlackDemand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DemandDetailSheet = ({ demand, open, onOpenChange }: DemandDetailSheetProps) => {
  if (!demand) return null;

  const priority = PRIORITY_CONFIG[demand.priority];
  const status = STATUS_CONFIG[demand.status];

  const formatDate = (iso: string) =>
    format(new Date(iso), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-[10px] ${priority.bg} ${priority.color}`}>
              {priority.label}
            </Badge>
            <Badge variant="secondary" className={`text-[10px] ${status.bg} ${status.color}`}>
              {status.label}
            </Badge>
          </div>
          <SheetTitle className="text-lg leading-snug mt-2">
            {demand.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Countdown */}
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Tempo restante</p>
            <ExpirationCountdown
              dueDate={demand.dueDate}
              createdAt={demand.createdAt}
              status={demand.status}
            />
          </div>

          {/* Descricao */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1.5">Descricao</p>
            <p className="text-sm text-foreground leading-relaxed">{demand.description}</p>
          </div>

          <Separator />

          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User size={12} /> Responsavel
              </p>
              <p className="text-sm font-medium text-foreground">
                {demand.assignee?.name || "Nao atribuido"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MessageSquare size={12} /> Solicitante
              </p>
              <p className="text-sm font-medium text-foreground">{demand.requester.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={12} /> Criado em
              </p>
              <p className="text-sm font-medium text-foreground">{formatDate(demand.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={12} /> Prazo
              </p>
              <p className="text-sm font-medium text-foreground">{formatDate(demand.dueDate)}</p>
            </div>
          </div>

          {demand.completedAt && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Concluido em</p>
              <p className="text-sm font-medium text-success">{formatDate(demand.completedAt)}</p>
            </div>
          )}

          <Separator />

          {/* Tags */}
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
