import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Hash, User, Calendar, Clock, MessageSquare, UserCog, Building2, Layers, Package, MessageCircle, Link2, AlertTriangle, CheckCircle2, Signal, Info, Sparkles, X, Plus, Paperclip, FileText, Image, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG, DemandStatus, DemandPriority,
  ClosureFields, ClosureAttachment, CATEGORY_OPTIONS, EXPIRATION_REASON_OPTIONS, SUPPORT_LEVEL_OPTIONS,
  DemandCategory, ExpirationReason, SupportLevel,
} from "@/types/demand";
import { extractClientName } from "@/data/demandsLoader";
import { addBusinessHours, getFirstResponseMinutes, getResolutionMinutes, formatBusinessTime, getBusinessMinutesBetween } from "@/lib/businessHours";
import ExpirationCountdown from "./ExpirationCountdown";

function parseResponseSla(sla: string): number {
  const match = sla.match(/(\d+)\s*(min|hora|horas)/i);
  if (!match) return 60;
  const val = parseInt(match[1]);
  return match[2].startsWith("hora") ? val * 60 : val;
}

interface DemandDetailSheetProps {
  demand: SlackDemand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: string[];
  onAssigneeChange: (demandId: string, assignee: string | null) => void;
  onStatusChange: (demandId: string, status: string, completedAt?: string) => void;
  onPriorityChange: (demandId: string, priority: DemandPriority) => void;
  onAddAssignee: (name: string) => void;
  onClosureChange: (demandId: string, closure: Partial<ClosureFields>) => void;
  categories: DemandCategory[];
  onAddCategory: (name: string) => void;
}

const DemandDetailSheet = ({ demand, open, onOpenChange, assignees, onAssigneeChange, onStatusChange, onPriorityChange, onAddAssignee, onClosureChange, categories, onAddCategory }: DemandDetailSheetProps) => {
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeDate, setCompleteDate] = useState("");
  const [completeTime, setCompleteTime] = useState("");
  const [completeObservation, setCompleteObservation] = useState("");
  const [showAddAssignee, setShowAddAssignee] = useState(false);
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const newAssigneeRef = useRef<HTMLInputElement>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const newCategoryRef = useRef<HTMLInputElement>(null);

  // Reset forms when demand changes
  useEffect(() => {
    setShowCompleteForm(false);
    setShowAddAssignee(false);
    setNewAssigneeName("");
    setShowAddCategory(false);
    setNewCategoryName("");
    setCompleteObservation("");
    if (demand) {
      const now = new Date();
      setCompleteDate(format(now, "yyyy-MM-dd"));
      setCompleteTime(format(now, "HH:mm"));
      setCompleteObservation(demand.closure?.observation || "");
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
    if (completeObservation.trim()) {
      onClosureChange(demand.id, { observation: completeObservation.trim() });
    }
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
            <Select
              value={demand.assignee?.name || "_none_"}
              onValueChange={(v) => {
                if (v === "__add_new__") {
                  setShowAddAssignee(true);
                  setTimeout(() => newAssigneeRef.current?.focus(), 100);
                } else {
                  onAssigneeChange(demand.id, v === "_none_" ? null : v);
                }
              }}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Sem responsavel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Sem responsavel</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
                <SelectItem value="__add_new__">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Plus size={12} /> Adicionar responsavel...
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {showAddAssignee && (
              <div className="mt-2 flex gap-2">
                <Input
                  ref={newAssigneeRef}
                  placeholder="Nome do responsavel"
                  className="h-9 flex-1"
                  value={newAssigneeName}
                  onChange={(e) => setNewAssigneeName(e.target.value)}
                  maxLength={50}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newAssigneeName.trim()) {
                      onAddAssignee(newAssigneeName.trim());
                      onAssigneeChange(demand.id, newAssigneeName.trim());
                      setNewAssigneeName("");
                      setShowAddAssignee(false);
                    }
                    if (e.key === "Escape") setShowAddAssignee(false);
                  }}
                />
                <Button
                  size="sm"
                  className="h-9 text-xs"
                  disabled={!newAssigneeName.trim()}
                  onClick={() => {
                    if (newAssigneeName.trim()) {
                      onAddAssignee(newAssigneeName.trim());
                      onAssigneeChange(demand.id, newAssigneeName.trim());
                      setNewAssigneeName("");
                      setShowAddAssignee(false);
                    }
                  }}
                >
                  Adicionar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setShowAddAssignee(false)}
                >
                  <X size={14} />
                </Button>
              </div>
            )}
          </div>

          {/* Prioridade - editavel */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Signal size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Prioridade</p>
            </div>
            <Select value={demand.priority} onValueChange={(v) => onPriorityChange(demand.id, v as DemandPriority)}>
              <SelectTrigger className={`w-full h-9 text-sm font-medium ${priority.color}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p1">P1 - Critico</SelectItem>
                <SelectItem value="p2">P2 - Alta</SelectItem>
                <SelectItem value="p3">P3 - Media</SelectItem>
                <SelectItem value="sem_classificacao">Sem classificacao</SelectItem>
              </SelectContent>
            </Select>

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
            <Select value={showCompleteForm ? "concluida" : demand.status} onValueChange={handleStatusChange}>
              <SelectTrigger className={`w-full h-9 text-sm font-medium ${status.color}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluida</SelectItem>
                <SelectItem value="expirada">Expirada</SelectItem>
              </SelectContent>
            </Select>

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
                  <div className="w-24 sm:w-28">
                    <label className="text-[11px] text-muted-foreground">Horario</label>
                    <Input
                      type="time"
                      className="h-9 mt-1"
                      value={completeTime}
                      onChange={(e) => setCompleteTime(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Observação</label>
                  <textarea
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-y min-h-[48px]"
                    rows={2}
                    maxLength={2000}
                    placeholder="Observação sobre a conclusão (opcional)..."
                    value={completeObservation}
                    onChange={(e) => setCompleteObservation(e.target.value)}
                  />
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

          {/* Status analysis */}
          {demand.statusAnalysis && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={12} className="text-primary" />
                <span className="text-[11px] font-semibold text-primary">Deteccao automatica de status</span>
                <Badge variant="secondary" className="text-[9px] ml-auto">
                  {demand.statusAnalysis.confidence === "alta" ? "Alta confianca" :
                   demand.statusAnalysis.confidence === "media" ? "Media confianca" : "Baixa confianca"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {demand.statusAnalysis.reason}
              </p>
              {demand.manualStatusOverride && (
                <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                  <Info size={10} /> Status foi alterado manualmente (override)
                </p>
              )}
            </div>
          )}

          {/* Thread replies timeline */}
          {demand.threadReplies.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Respostas da thread ({demand.threadReplies.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {demand.threadReplies.map((reply, i) => (
                  <div key={i} className={`p-2.5 rounded-lg text-[11px] ${reply.isTeamMember ? "bg-primary/5 border-l-2 border-l-primary" : "bg-muted/50"}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-semibold ${reply.isTeamMember ? "text-primary" : "text-foreground"}`}>
                        {reply.author}
                        {reply.isTeamMember && <span className="text-[9px] font-normal text-muted-foreground ml-1">(equipe)</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(reply.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{reply.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Descricao */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1.5">Descricao</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{demand.description}</p>
          </div>

          <Separator />

          {/* Detalhes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            <div className="p-3 rounded-lg bg-success/5 border border-success/20 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Concluido em</p>
                <p className="text-sm font-medium text-success">{formatDate(demand.completedAt)}</p>
              </div>
              {demand.closure?.observation && (
                <div>
                  <p className="text-xs text-muted-foreground">Observação</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{demand.closure.observation}</p>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* SLA */}
          {demand.priority !== "sem_classificacao" && priority.sla && (() => {
            const firstRespMinutes = getFirstResponseMinutes(demand.createdAt, demand.threadReplies);
            const slaRespMinutes = parseResponseSla(priority.sla.response);
            const firstRespOk = firstRespMinutes !== null ? firstRespMinutes <= slaRespMinutes : null;

            const resolutionMinutes = getResolutionMinutes(demand.createdAt, demand.completedAt);
            const slaResMinutes = priority.sla.resolutionHours * 60;
            const resolutionOk = resolutionMinutes !== null ? resolutionMinutes <= slaResMinutes : null;

            return (
              <>
                <div className="p-4 rounded-lg border border-border space-y-4">
                  <p className="text-xs text-muted-foreground font-medium">SLA - {priority.label}</p>
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

                  {/* SLA Tracking */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {/* 1a Resposta */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">1a Resposta</span>
                      {firstRespMinutes !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-foreground">{formatBusinessTime(firstRespMinutes)}</span>
                          <Badge variant="secondary" className={`text-[9px] px-1.5 ${firstRespOk ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                            {firstRespOk ? "No prazo" : "Atrasada"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Aguardando resposta</span>
                      )}
                    </div>

                    {/* Resolucao */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Resolucao</span>
                      {resolutionMinutes !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-foreground">{formatBusinessTime(resolutionMinutes)}</span>
                          <Badge variant="secondary" className={`text-[9px] px-1.5 ${resolutionOk ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                            {resolutionOk ? "No prazo" : "Estourado"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Em aberto</span>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            );
          })()}

          {/* Closure fields */}
          {(demand.status === "concluida" || demand.status === "expirada" || demand.status === "em_andamento") && (
            <div className="p-4 rounded-lg border border-border space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers size={14} className="text-primary" />
                Campos de fechamento
              </p>

              {/* Categoria */}
              <div>
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Categoria
                  {demand.closure?.autoFilled?.category && (
                    <Sparkles size={10} className="text-primary" />
                  )}
                </label>
                <Select
                  value={demand.closure?.category || "_none_"}
                  onValueChange={(v) => {
                    if (v === "__add_new__") {
                      setShowAddCategory(true);
                      setTimeout(() => newCategoryRef.current?.focus(), 100);
                    } else {
                      onClosureChange(demand.id, { category: (v === "_none_" ? "" : v) as DemandCategory });
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-9 mt-1 text-sm">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Selecionar...</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="__add_new__">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Plus size={12} /> Adicionar categoria...
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {showAddCategory && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      ref={newCategoryRef}
                      placeholder="Nome da categoria"
                      className="h-9 flex-1"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      maxLength={40}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCategoryName.trim()) {
                          onAddCategory(newCategoryName.trim());
                          onClosureChange(demand.id, { category: newCategoryName.trim() as DemandCategory });
                          setNewCategoryName(""); setShowAddCategory(false);
                        }
                        if (e.key === "Escape") setShowAddCategory(false);
                      }}
                    />
                    <Button size="sm" className="h-9 text-xs" disabled={!newCategoryName.trim()}
                      onClick={() => {
                        if (newCategoryName.trim()) {
                          onAddCategory(newCategoryName.trim());
                          onClosureChange(demand.id, { category: newCategoryName.trim() as DemandCategory });
                          setNewCategoryName(""); setShowAddCategory(false);
                        }
                      }}>Adicionar</Button>
                    <Button variant="ghost" size="sm" className="h-9" onClick={() => setShowAddCategory(false)}>
                      <X size={14} />
                    </Button>
                  </div>
                )}
              </div>

              {/* Nivel de suporte */}
              <div>
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Nivel de suporte
                  {demand.closure?.autoFilled?.supportLevel && (
                    <Sparkles size={10} className="text-primary" />
                  )}
                </label>
                <Select
                  value={demand.closure?.supportLevel || "_none_"}
                  onValueChange={(v) => onClosureChange(demand.id, { supportLevel: (v === "_none_" ? "" : v) as SupportLevel })}
                >
                  <SelectTrigger className="w-full h-9 mt-1 text-sm">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Selecionar...</SelectItem>
                    {SUPPORT_LEVEL_OPTIONS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Motivo de expiracao - so aparece quando SLA expirado */}
              {(demand.status === "expirada" || (() => {
                if (demand.priority === "sem_classificacao") return false;
                const cfg = PRIORITY_CONFIG[demand.priority];
                if (!cfg.sla) return false;
                const due = addBusinessHours(new Date(demand.createdAt), cfg.sla.resolutionHours);
                return new Date() > due;
              })()) && (
                <div>
                  <label className="text-[11px] text-destructive flex items-center gap-1">
                    Motivo de expiracao (SLA estourado)
                    {demand.closure?.autoFilled?.expirationReason && (
                      <Sparkles size={10} className="text-primary" />
                    )}
                  </label>
                  <Select
                    value={demand.closure?.expirationReason || "_none_"}
                    onValueChange={(v) => onClosureChange(demand.id, { expirationReason: (v === "_none_" ? "" : v) as ExpirationReason })}
                  >
                    <SelectTrigger className="w-full h-9 mt-1 text-sm">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Selecionar...</SelectItem>
                      {EXPIRATION_REASON_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Resolução */}
              <div>
                <label className="text-[11px] text-muted-foreground">Resolução</label>
                <textarea
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-y min-h-[80px]"
                  rows={5}
                  maxLength={5000}
                  placeholder="Descreva a resolução da demanda..."
                  value={demand.closure?.internalComment || ""}
                  onChange={(e) => onClosureChange(demand.id, { internalComment: e.target.value })}
                />
                <div className="flex items-center justify-between mt-0.5">
                  <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    <Paperclip size={12} />
                    <span>Anexar arquivo</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        const existing = demand.closure?.attachments || [];
                        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
                        Array.from(files).forEach((file) => {
                          if (file.size > MAX_FILE_SIZE) {
                            alert(`Arquivo "${file.name}" excede o limite de 5MB.`);
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const attachment: ClosureAttachment = {
                              id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                              name: file.name,
                              type: file.type,
                              size: file.size,
                              dataUrl: reader.result as string,
                              addedAt: new Date().toISOString(),
                            };
                            onClosureChange(demand.id, { attachments: [...existing, attachment] });
                            existing.push(attachment);
                          };
                          reader.readAsDataURL(file);
                        });
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    {(demand.closure?.internalComment || "").length}/5000
                  </span>
                </div>

                {/* Lista de anexos */}
                {(demand.closure?.attachments || []).length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {(demand.closure?.attachments || []).map((att) => (
                      <div key={att.id} className="flex items-center gap-2 p-2 rounded-md border border-input bg-muted/30 group">
                        {att.type.startsWith("image/") ? (
                          <Image size={14} className="text-blue-500 shrink-0" />
                        ) : (
                          <FileText size={14} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="text-xs truncate flex-1" title={att.name}>{att.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {att.size < 1024 ? `${att.size}B` : att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(0)}KB` : `${(att.size / (1024 * 1024)).toFixed(1)}MB`}
                        </span>
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Baixar"
                        >
                          <Download size={13} className="text-muted-foreground hover:text-foreground" />
                        </a>
                        <button
                          onClick={() => {
                            const updated = (demand.closure?.attachments || []).filter((a) => a.id !== att.id);
                            onClosureChange(demand.id, { attachments: updated });
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover"
                        >
                          <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

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
