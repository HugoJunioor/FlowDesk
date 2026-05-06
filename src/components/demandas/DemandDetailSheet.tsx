import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Hash, User, Calendar, Clock, MessageSquare, UserCog, Building2, Layers, Package, MessageCircle, Link2, AlertTriangle, Circle, Signal, Info, Sparkles, X, Plus, Paperclip, FileText, Image, Download, Trash2 } from "lucide-react";
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
import CopyLinkButton from "./CopyLinkButton";
import DemandReplyComposer from "./DemandReplyComposer";
import SlackFilesList from "./SlackFilesList";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, ApiError } from "@/lib/apiClient";
import { toast } from "sonner";

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
  /** Lista completa de motivos de expiracao (built-in + customizados) */
  expirationReasons?: string[];
  /** Callback para cadastrar novo motivo */
  onAddExpirationReason?: (name: string) => void;
  /** Callback para salvar o link da task */
  onTaskLinkChange?: (demandId: string, taskLink: string) => void;
}

const DemandDetailSheet = ({
  demand,
  open,
  onOpenChange,
  assignees,
  onAssigneeChange,
  onStatusChange,
  onPriorityChange,
  onAddAssignee,
  onClosureChange,
  categories,
  onAddCategory,
  expirationReasons,
  onAddExpirationReason,
  onTaskLinkChange,
}: DemandDetailSheetProps) => {
  const { currentUser } = useAuth();
  const currentUserName = currentUser?.name || currentUser?.login || "Equipe";
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
  const [showAddReason, setShowAddReason] = useState(false);
  const [newReasonName, setNewReasonName] = useState("");
  const newReasonRef = useRef<HTMLInputElement>(null);
  const [showTaskEdit, setShowTaskEdit] = useState(false);
  const [taskLinkDraft, setTaskLinkDraft] = useState("");

  // Replies otimistas — enviadas via composer, aparecem na thread imediatamente
  // antes do proximo sync. Limpa quando troca de demanda ou re-sync traz a real.
  const [refreshingThread, setRefreshingThread] = useState(false);
  const [extraReplies, setExtraReplies] = useState<Array<{ author: string; text: string; timestamp: string; isTeamMember: boolean; files?: Array<{ id: string; name: string; mimetype: string; size: number; urlPrivate?: string; thumb360?: string; isPublic?: boolean }> }>>([]);
  const [optimisticReplies, setOptimisticReplies] = useState<Array<{
    author: string;
    text: string;
    timestamp: string;
    isTeamMember: boolean;
    pendingTs: string;
  }>>([]);

  // Reset forms when demand changes
  useEffect(() => {
    setShowCompleteForm(false);
    setShowAddAssignee(false);
    setNewAssigneeName("");
    setShowAddCategory(false);
    setNewCategoryName("");
    setShowAddReason(false);
    setNewReasonName("");
    setShowTaskEdit(false);
    setTaskLinkDraft(demand?.taskLink || "");
    setCompleteObservation("");
    setOptimisticReplies([]); // limpa otimistas ao trocar demanda
    setExtraReplies([]);      // limpa replies do refresh manual
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

  // Check if SLA is expired: usa slaResolutionStatus da planilha (historico) ou calcula em runtime
  const isSlaBreach = (() => {
    if (demand.slaResolutionStatus) return demand.slaResolutionStatus === "expirado";
    if (demand.priority === "sem_classificacao") return false;
    if (demand.status === "concluida") return false;
    const config = PRIORITY_CONFIG[demand.priority];
    if (!config.sla) return false;
    const due = addBusinessHours(new Date(demand.createdAt), config.sla.resolutionHours);
    return new Date() > due;
  })();

  const formatDate = (iso: string) =>
    format(new Date(iso), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });

  // Refresh thread — busca replies frescas do Slack
  const refreshThread = async () => {
    if (refreshingThread) return;
    setRefreshingThread(true);
    try {
      const res = await apiClient.slack.threadReplies(demand.slackPermalink);
      // Marca team members pelos nomes ja conhecidos
      const teamNames = new Set(
        demand.threadReplies.filter((r) => r.isTeamMember).map((r) => r.author.toLowerCase())
      );
      if (currentUser?.name) teamNames.add(currentUser.name.toLowerCase());
      // Mapeia replies do slack pra formato local + filtra repetidas (ja em threadReplies)
      const existingTexts = new Set(demand.threadReplies.map((r) => `${r.author}|${r.text}`));
      const fresh = res.replies
        .map((r) => ({
          author: r.author,
          text: r.text,
          timestamp: r.timestamp,
          isTeamMember: teamNames.has(r.author.toLowerCase()) || r.isBot,
          files: r.files,
        }))
        .filter((r) => !existingTexts.has(`${r.author}|${r.text}`));
      setExtraReplies(fresh);
      // Tira otimistas que ja vieram
      setOptimisticReplies((prev) =>
        prev.filter((o) => !res.replies.some((r) => r.text === o.text))
      );
      toast.success(`${fresh.length} novas mensagens` , {
        description: `Total na thread: ${res.count}`,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error("Falha ao atualizar thread", { description: msg });
    } finally {
      setRefreshingThread(false);
    }
  };

  // Edit/delete handlers — backend (chat.update / chat.delete via flowdesk-api)
  const handleEditReply = async (reply: { text: string; timestamp: string }) => {
    const newText = window.prompt("Editar mensagem:", reply.text);
    if (newText === null || newText.trim() === "" || newText === reply.text) return;
    try {
      // ts no Slack eh derivado do timestamp via permalink — em commit futuro
      // passamos o ts direto. Por hora, busca via permalink.
      await apiClient.slack.editReply({
        permalink: demand.slackPermalink,
        replyTimestamp: reply.timestamp,
        newText,
      });
      toast.success("Mensagem atualizada no Slack");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error("Falha ao editar", { description: msg });
    }
  };

  const handleDeleteReply = async (reply: { text: string; timestamp: string }) => {
    if (!window.confirm(`Excluir mensagem?\n\n"${reply.text.slice(0, 100)}${reply.text.length > 100 ? "..." : ""}"`)) return;
    try {
      await apiClient.slack.deleteReply({
        permalink: demand.slackPermalink,
        replyTimestamp: reply.timestamp,
      });
      toast.success("Mensagem excluída do Slack");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error("Falha ao excluir", { description: msg });
    }
  };

  // Combina: replies do sync + extra (refresh manual) + otimistas (em voo).
  // Dedup por author+text. Otimisticas/extras sumem quando sync proximo trouxer.
  const mergedReplies = (() => {
    const real = demand.threadReplies || [];
    const seen = new Set(real.map((r) => `${r.author}|${r.text}`));
    const fromExtra = extraReplies.filter((e) => {
      const k = `${e.author}|${e.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const stillPending = optimisticReplies.filter(
      (o) => !seen.has(`${o.author}|${o.text}`)
    );
    return [...real, ...fromExtra, ...stillPending].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  })();

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header fixo (alinhado com a coluna de conteudo, nao stretches edge-to-edge) */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 max-w-4xl w-full mx-auto">
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
          <DialogTitle className="text-lg leading-snug mt-2">
            {demand.title}
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-primary/80 font-medium">
              <Building2 size={12} /> {client}
            </span>
            <span className="flex items-center gap-1">
              <Layers size={12} /> {demand.workflow}
            </span>
          </div>
        </DialogHeader>
        {/* Conteudo scrollavel — limitado a ~720px centralizado pra harmonia
            (campos curtos como prioridade, status, badges nao precisam de
            largura total). Composer abaixo continua full width. */}
        <div className="flex-1 overflow-y-auto px-6 py-4 max-w-4xl w-full mx-auto">

        <div className="space-y-3">
          {/* Layout 2-col: esq = Tempo + Responsavel + Status; dir = Prioridade + Deteccao */}
          {(() => {
            const showCountdown = demand.priority !== "sem_classificacao" && demand.status !== "concluida";

            const countdownBlock = showCountdown ? (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Tempo restante (horario util)</p>
                <ExpirationCountdown
                  dueDate={demand.dueDate || ""}
                  createdAt={demand.createdAt}
                  status={demand.status}
                  priority={demand.priority}
                  completedAt={demand.completedAt}
                  expirationReason={demand.closure?.expirationReason}
                />
              </div>
            ) : null;

            const responsavelBlock = (
              <div className="p-3 rounded-lg border border-border">
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
                    <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setShowAddAssignee(false)}>
                      <X size={14} />
                    </Button>
                  </div>
                )}
              </div>
            );

            const statusBlock = (
              <div className="p-3 rounded-lg border border-border">
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
                {showCompleteForm && (
                  <div className="mt-3 p-3 rounded-lg bg-success/5 border border-success/20 space-y-3">
                    <p className="text-xs font-medium text-success flex items-center gap-1">
                      <Circle size={12} fill="currentColor" />
                      Informe a data e horario da conclusao
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] text-muted-foreground">Data</label>
                        <Input type="date" className="h-9 mt-1" value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} />
                      </div>
                      <div className="w-24 sm:w-28">
                        <label className="text-[11px] text-muted-foreground">Horario</label>
                        <Input type="time" className="h-9 mt-1" value={completeTime} onChange={(e) => setCompleteTime(e.target.value)} />
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
                        <Circle size={13} fill="currentColor" className="mr-1" />
                        Confirmar Conclusao
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowCompleteForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );

            const prioridadeBlock = (
              <div className="p-3 rounded-lg border border-border">
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
            );

            const deteccaoBlock = demand.statusAnalysis ? (
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
            ) : null;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Coluna esquerda: Tempo, Responsavel, Status (vertical) */}
                <div className="space-y-3">
                  {countdownBlock}
                  {responsavelBlock}
                  {statusBlock}
                </div>
                {/* Coluna direita: Prioridade, Deteccao (vertical) */}
                <div className="space-y-3">
                  {prioridadeBlock}
                  {deteccaoBlock}
                </div>
              </div>
            );
          })()}

          {/* Descricao */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1.5">Descricao</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{demand.description}</p>
            {demand.files && demand.files.length > 0 && (
              <SlackFilesList files={demand.files} />
            )}
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

          {/* Thread replies + composer (apos descricao + detalhes pra contexto) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">
                Respostas da thread ({mergedReplies.length})
                {optimisticReplies.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-warning">
                    · {optimisticReplies.length} pendente{optimisticReplies.length > 1 ? "s" : ""}
                  </span>
                )}
                {extraReplies.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-success">
                    · {extraReplies.length} novas
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={refreshThread}
                disabled={refreshingThread}
                className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                title="Buscar mensagens novas direto do Slack"
              >
                <span className={refreshingThread ? "inline-block animate-spin" : ""}>↻</span>
                {refreshingThread ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
            {mergedReplies.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-3">
                {mergedReplies.map((reply, i) => {
                  const isOptimistic = "pendingTs" in reply;
                  const isOwn = reply.isTeamMember && reply.author === currentUserName;
                  return (
                    <div
                      key={i}
                      className={`group p-2.5 rounded-lg text-[11px] transition-opacity ${
                        reply.isTeamMember ? "bg-primary/5 border-l-2 border-l-primary" : "bg-muted/50"
                      } ${isOptimistic ? "opacity-70 ring-1 ring-warning/40" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-semibold ${reply.isTeamMember ? "text-primary" : "text-foreground"}`}>
                          {reply.author}
                          {reply.isTeamMember && <span className="text-[9px] font-normal text-muted-foreground ml-1">(equipe)</span>}
                          {isOptimistic && <span className="text-[9px] font-normal text-warning ml-1">(enviando...)</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Acoes em mensagens proprias enviadas pelo Slack */}
                          {isOwn && !isOptimistic && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="text-[10px] text-muted-foreground hover:text-primary"
                                onClick={() => handleEditReply(reply)}
                                title="Editar mensagem"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="text-[10px] text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteReply(reply)}
                                title="Excluir mensagem"
                              >
                                Excluir
                              </button>
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(reply.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{reply.text}</p>
                      {"files" in reply && reply.files && reply.files.length > 0 && (
                        <SlackFilesList files={reply.files} compact />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="rounded-lg border border-border overflow-hidden">
              <DemandReplyComposer
                demand={demand}
                onReplied={(text, ts) => {
                  setOptimisticReplies((prev) => [...prev, {
                    author: currentUserName,
                    text,
                    timestamp: new Date().toISOString(),
                    isTeamMember: true,
                    pendingTs: ts,
                  }]);
                  // Auto-refresh apos envio pra confirmar do Slack (~2s)
                  setTimeout(() => { void refreshThread(); }, 2000);
                }}
              />
            </div>
          </div>

          <Separator />

          {/* SLA */}
          {demand.priority !== "sem_classificacao" && priority.sla && (() => {
            const firstRespMinutes = getFirstResponseMinutes(demand.createdAt, demand.threadReplies, demand.slaFirstResponse);
            const slaRespMinutes = parseResponseSla(priority.sla.response);
            const firstRespOk = firstRespMinutes !== null ? firstRespMinutes <= slaRespMinutes : null;

            const resolutionMinutes = getResolutionMinutes(demand.createdAt, demand.completedAt);
            const slaResMinutes = priority.sla.resolutionHours * 60;
            // Usa slaResolutionStatus da planilha (historico) ou calcula em runtime (abril+)
            const resolutionOk = demand.slaResolutionStatus
              ? demand.slaResolutionStatus === "atendido"
              : (resolutionMinutes !== null ? resolutionMinutes <= slaResMinutes : null);

            return (
              <>
                <div className="p-3 rounded-lg border border-border space-y-4">
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
            <div className="p-3 rounded-lg border border-border space-y-3">
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
              {isSlaBreach && (
                <div>
                  <label className="text-[11px] text-destructive flex items-center gap-1">
                    Motivo de expiracao (SLA estourado)
                    {demand.closure?.autoFilled?.expirationReason && (
                      <Sparkles size={10} className="text-primary" />
                    )}
                  </label>
                  <Select
                    value={demand.closure?.expirationReason || "_none_"}
                    onValueChange={(v) => {
                      if (v === "__add_new_reason__") {
                        setShowAddReason(true);
                        setTimeout(() => newReasonRef.current?.focus(), 100);
                      } else {
                        onClosureChange(demand.id, { expirationReason: (v === "_none_" ? "" : v) as ExpirationReason });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-9 mt-1 text-sm">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Selecionar...</SelectItem>
                      {(expirationReasons ?? EXPIRATION_REASON_OPTIONS).map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                      {onAddExpirationReason && (
                        <SelectItem value="__add_new_reason__">
                          <span className="flex items-center gap-1.5 text-primary">
                            <Plus size={12} /> Adicionar motivo...
                          </span>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {showAddReason && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        ref={newReasonRef}
                        placeholder="Nome do motivo"
                        className="h-9 flex-1"
                        value={newReasonName}
                        onChange={(e) => setNewReasonName(e.target.value)}
                        maxLength={60}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newReasonName.trim()) {
                            onAddExpirationReason?.(newReasonName.trim());
                            onClosureChange(demand.id, { expirationReason: newReasonName.trim() as ExpirationReason });
                            setNewReasonName("");
                            setShowAddReason(false);
                          }
                          if (e.key === "Escape") setShowAddReason(false);
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-9 text-xs"
                        disabled={!newReasonName.trim()}
                        onClick={() => {
                          onAddExpirationReason?.(newReasonName.trim());
                          onClosureChange(demand.id, { expirationReason: newReasonName.trim() as ExpirationReason });
                          setNewReasonName("");
                          setShowAddReason(false);
                        }}
                      >
                        Adicionar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 text-xs"
                        onClick={() => { setShowAddReason(false); setNewReasonName(""); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
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

          {/* Task associada (editavel) */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Link2 size={14} className="text-muted-foreground shrink-0" />
                <span className="text-[11px] font-medium text-foreground">Task associada</span>
              </div>
              {onTaskLinkChange && !showTaskEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setTaskLinkDraft(demand.taskLink || "");
                    setShowTaskEdit(true);
                  }}
                >
                  {demand.taskLink ? "Editar" : "Adicionar"}
                </Button>
              )}
            </div>
            {showTaskEdit ? (
              <div className="flex gap-2">
                <Input
                  placeholder="https://app.clickup.com/... (ou outra URL)"
                  className="h-8 text-xs flex-1"
                  value={taskLinkDraft}
                  onChange={(e) => setTaskLinkDraft(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onTaskLinkChange?.(demand.id, taskLinkDraft.trim());
                      setShowTaskEdit(false);
                    }
                    if (e.key === "Escape") {
                      setShowTaskEdit(false);
                      setTaskLinkDraft(demand.taskLink || "");
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    onTaskLinkChange?.(demand.id, taskLinkDraft.trim());
                    setShowTaskEdit(false);
                  }}
                >
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    setShowTaskEdit(false);
                    setTaskLinkDraft(demand.taskLink || "");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : demand.taskLink ? (
              <div className="flex items-center gap-2">
                <a
                  href={demand.taskLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate flex-1"
                >
                  {demand.taskLink}
                </a>
                <CopyLinkButton url={demand.taskLink} size={12} />
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">
                Nenhuma task vinculada. Cole o link da task do ClickUp, Jira, etc.
              </p>
            )}
          </div>

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
            <div className="flex items-center gap-1.5">
              <CopyLinkButton url={demand.slackPermalink} size={12} />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <a href={demand.slackPermalink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} />
                  Abrir no Slack
                </a>
              </Button>
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemandDetailSheet;
