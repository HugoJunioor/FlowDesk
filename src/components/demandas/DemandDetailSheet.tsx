import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Hash, User, Calendar, Clock, MessageSquare, UserCog, Building2, Layers, Package, MessageCircle, Link2, AlertTriangle, CheckCircle2, Signal, Info, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG, DemandStatus, DemandPriority } from "@/types/demand";
import { extractClientName } from "@/data/mockDemands";
import { addBusinessHours } from "@/lib/businessHours";
import ExpirationCountdown from "./ExpirationCountdown";

interface DemandDetailSheetProps {
  demand: SlackDemand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: string[];
  onAssigneeChange: (demandId: string, assignee: string | null) => void;
  onStatusChange: (demandId: string, status: string, completedAt?: string) => void;
  onPriorityChange: (demandId: string, priority: DemandPriority) => void;
}

const DemandDetailSheet = ({ demand, open, onOpenChange, assignees, onAssigneeChange, onStatusChange, onPriorityChange }: DemandDetailSheetProps) => {
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeDate, setCompleteDate] = useState("");
  const [completeTime, setCompleteTime] = useState("");

  // Reset form when demand changes
  useEffect(() => {
    setShowCompleteForm(false);
    if (demand) {
      const now = new Date();
      setCompleteDate(format(now, "yyyy-MM-dd"));
      setCompleteTime(format(now, "HH:mm"));
    }
  }, [demand?.id]);

  if (!demand) return null;

  const priority = PRIORITY_CONFIG[demand.priority];
  const status = STATUS_CONFIG[demand.status];
  const client = extractClientName(demand.slackChannel);

  // Check if SLA is expired automatically
  const isSlaBreach = (() => {
    if (demand.priority === "sem_classificacao") return false;
    if (demand.status === "concluida") return false;
    const config = PRIORITY_CONFIG[demand.priority];
    if (!config.sla) return false;
    const due = addBusinessHours(new Date(demand.createdAt), config.sla.resolutionHours);
    return new Date() > due;
  })();

  const formatDate = (iso: string) =>
    format(new Date(iso), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "concluida") {
      setShowCompleteForm(true);
      return;
    }
    setShowCompleteForm(false);
    onStatusChange(demand.id, newStatus);
  };

  const handleConfirmComplete = () => {
    if (!completeDate || !completeTime) return;
    const completedAt = new Date(`${completeDate}T${completeTime}:00`).toISOString();
    onStatusChange(demand.id, "concluida", completedAt);
    setShowCompleteForm(false);
  };

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
            {isSlaBreach && demand.status !== "expirada" && (
              <Badge variant="secondary" className="text-[10px] bg-destructive/10 text-destructive animate-pulse">
                <AlertTriangle size={10} className="mr-0.5" />
                SLA Estourado
              </Badge>
            )}
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
          {/* Countdown */}
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

          {/* Responsavel */}
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

          {/* Prioridade - editavel */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Signal size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Prioridade</p>
            </div>
            <select
              className={`w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-medium ${priority.color}`}
              value={demand.priority}
              onChange={(e) => onPriorityChange(demand.id, e.target.value as DemandPriority)}
            >
              <option value="p1">P1 - Critico</option>
              <option value="p2">P2 - Alta</option>
              <option value="p3">P3 - Media</option>
              <option value="sem_classificacao">Sem classificacao</option>
            </select>

            {/* Auto classification info */}
            {demand.autoClassification && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={12} className="text-primary" />
                  <span className="text-[11px] font-semibold text-primary">Classificacao automatica</span>
                  <Badge variant="secondary" className="text-[9px] ml-auto">
                    {demand.autoClassification.confidence === "alta" ? "Alta confianca" :
                     demand.autoClassification.confidence === "media" ? "Media confianca" : "Baixa confianca"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {demand.autoClassification.reason}
                </p>
                {demand.autoClassification.matchedKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {demand.autoClassification.matchedKeywords.slice(0, 5).map((kw) => (
                      <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Status</p>
            </div>
            <select
              className={`w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-medium ${status.color}`}
              value={showCompleteForm ? "concluida" : demand.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="aberta">Aberta</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluida</option>
              <option value="expirada">Expirada</option>
            </select>

            {/* Formulario de conclusao */}
            {showCompleteForm && (
              <div className="mt-3 p-3 rounded-lg bg-success/5 border border-success/20 space-y-3">
                <p className="text-xs font-medium text-success flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Informe a data e horario da conclusao
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground">Data</label>
                    <Input
                      type="date"
                      className="h-9 mt-1"
                      value={completeDate}
                      onChange={(e) => setCompleteDate(e.target.value)}
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-[11px] text-muted-foreground">Horario</label>
                    <Input
                      type="time"
                      className="h-9 mt-1"
                      value={completeTime}
                      onChange={(e) => setCompleteTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-xs flex-1" onClick={handleConfirmComplete}>
                    <CheckCircle2 size={13} className="mr-1" />
                    Confirmar Conclusao
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowCompleteForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
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
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-xs text-muted-foreground">Concluido em</p>
              <p className="text-sm font-medium text-success">{formatDate(demand.completedAt)}</p>
            </div>
          )}

          <Separator />

          {/* SLA */}
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
              <a href={demand.taskLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
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
