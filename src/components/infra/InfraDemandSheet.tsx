/**
 * Sheet lateral com detalhes completos de uma demanda Infra.
 *
 * Mostra todos os campos: titulo, descricao, prioridade, data limite,
 * banco, query, anexos, link, requester, assignee, datas.
 *
 * Permite mudar status (atender/concluir/reabrir) e a prioridade
 * direto do sheet.
 */
import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Database, Rocket, Copy, ExternalLink, Paperclip, Download, Clock,
  CheckCircle2, AlertCircle, Loader2, Trash2, User, UserCircle, Calendar,
  Pencil, Save, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { SlackDemand, PRIORITY_CONFIG } from "@/types/demand";
import { notifyStarted, notifyCompleted, notifyReopened } from "@/lib/notificationEvents";

interface InfraDemandSheetProps {
  demand: SlackDemand | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusVisual(s: SlackDemand["status"]) {
  const map = {
    aberta: { label: "Aberta", cls: "bg-warning/10 text-warning border-warning/30", icon: AlertCircle },
    em_andamento: { label: "Em andamento", cls: "bg-info/10 text-info border-info/30", icon: Loader2 },
    concluida: { label: "Concluída", cls: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
    expirada: { label: "Expirada", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: Clock },
  };
  return map[s] ?? map.aberta;
}

function priorityVisual(p: SlackDemand["priority"]) {
  if (p === "p1") return { label: "P1 — Crítico", cls: "bg-destructive/10 text-destructive border-destructive/30" };
  if (p === "p2") return { label: "P2 — Alta", cls: "bg-warning/10 text-warning border-warning/30" };
  if (p === "p3") return { label: "P3 — Média", cls: "bg-info/10 text-info border-info/30" };
  return { label: "—", cls: "bg-muted text-muted-foreground border-border" };
}

const InfraDemandSheet = ({ demand, open, onClose, onChanged }: InfraDemandSheetProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  // Reset ao abrir
  useEffect(() => {
    if (open && demand) {
      setEditingDescription(false);
      setDescDraft(demand.description || "");
    }
  }, [open, demand]);

  if (!demand) return null;

  const sb = statusVisual(demand.status);
  const pv = priorityVisual(demand.priority);
  const isOverdue =
    demand.dueDate &&
    demand.status !== "concluida" &&
    new Date(demand.dueDate) < new Date();

  const updateDemand = async (updates: Partial<SlackDemand>) => {
    setSaving(true);
    try {
      await apiClient.infra.update(demand.id, updates);
      // Dispara notificacao baseada na mudanca
      if (updates.status === "em_andamento" && demand.status !== "em_andamento") {
        void notifyStarted(demand, currentUser?.name);
      } else if (updates.status === "concluida" && demand.status !== "concluida") {
        void notifyCompleted(demand, currentUser?.name);
      } else if (updates.status === "aberta" && demand.status === "concluida") {
        void notifyReopened(demand, currentUser?.name);
      }
      toast({ title: "Demanda atualizada" });
      onChanged();
    } catch (e) {
      toast({
        title: "Erro ao atualizar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyQuery = async () => {
    const q = demand.infraQuery || "";
    if (!q) return;
    try {
      await navigator.clipboard.writeText(q);
      toast({ title: "Query copiada", description: `${q.length} caracteres` });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir demanda "${demand.title}"? Esta ação não pode ser desfeita.`)) return;
    setSaving(true);
    try {
      await apiClient.infra.remove(demand.id);
      toast({ title: "Demanda excluída" });
      onClose();
      onChanged();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setSaving(false);
    }
  };

  const saveDescription = () => {
    void updateDemand({ description: descDraft.trim() });
    setEditingDescription(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${pv.cls}`}>
              {pv.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${sb.cls}`}>
              {sb.label}
            </span>
            {isOverdue && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-destructive/15 text-destructive border-destructive/40">
                Em atraso
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-muted">
              {demand.infraKind === "deploy" ? (
                <span className="flex items-center gap-1"><Rocket size={10} /> Deploy</span>
              ) : (
                <span className="flex items-center gap-1"><Database size={10} /> SQL</span>
              )}
            </span>
          </div>
          <SheetTitle className="text-left text-lg break-words">{demand.title}</SheetTitle>
          <SheetDescription className="text-left text-xs">
            Aberta em {formatDateTime(demand.createdAt)} por <strong className="text-foreground">{demand.requester.name}</strong>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Acoes principais (mudar status + prioridade) */}
          <div className="flex items-center gap-2 flex-wrap">
            {demand.status === "aberta" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateDemand({ status: "em_andamento" })}
                disabled={saving}
              >
                <Loader2 size={14} className="mr-1.5" /> Atender
              </Button>
            )}
            {demand.status !== "concluida" && (
              <Button
                size="sm"
                onClick={() => updateDemand({ status: "concluida" })}
                disabled={saving}
              >
                <CheckCircle2 size={14} className="mr-1.5" /> Concluir
              </Button>
            )}
            {demand.status === "concluida" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateDemand({ status: "aberta", completedAt: null })}
                disabled={saving}
              >
                Reabrir
              </Button>
            )}

            {/* Mudar prioridade inline */}
            <Select
              value={demand.priority}
              onValueChange={(v) => updateDemand({ priority: v as SlackDemand["priority"] })}
              disabled={saving}
            >
              <SelectTrigger className="h-8 w-auto text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p1">P1 — Crítico</SelectItem>
                <SelectItem value="p2">P2 — Alta</SelectItem>
                <SelectItem value="p3">P3 — Média</SelectItem>
              </SelectContent>
            </Select>

            {currentUser?.role === "master" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                disabled={saving}
                className="ml-auto text-destructive hover:text-destructive"
              >
                <Trash2 size={14} className="mr-1.5" /> Excluir
              </Button>
            )}
          </div>

          {/* Metadados */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border rounded-md p-3">
            <div className="flex items-center gap-2">
              <User size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Solicitante:</span>
              <strong>{demand.requester.name}</strong>
            </div>
            <div className="flex items-center gap-2">
              <UserCircle size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Responsável:</span>
              <strong>{demand.assignee?.name ?? "—"}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Prazo:</span>
              <strong className={isOverdue ? "text-destructive" : ""}>
                {formatDateTime(demand.dueDate)}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Concluída em:</span>
              <strong>{demand.completedAt ? formatDateTime(demand.completedAt) : "—"}</strong>
            </div>
          </div>

          {/* Descricao editavel */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Descrição</label>
              {!editingDescription ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setEditingDescription(true)}
                >
                  <Pencil size={11} className="mr-1" /> Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => { setEditingDescription(false); setDescDraft(demand.description || ""); }}
                  >
                    <X size={11} className="mr-1" /> Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-xs"
                    onClick={saveDescription}
                    disabled={saving}
                  >
                    <Save size={11} className="mr-1" /> Salvar
                  </Button>
                </div>
              )}
            </div>
            {editingDescription ? (
              <Textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                rows={5}
                autoFocus
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-3 min-h-[60px]">
                {demand.description || <span className="text-muted-foreground italic">Sem descrição</span>}
              </div>
            )}
          </div>

          {/* Cliente / Produto */}
          {demand.product && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cliente afetado</label>
              <div className="text-sm bg-muted/30 rounded p-2 px-3">{demand.product}</div>
            </div>
          )}

          {/* Banco de dados */}
          {demand.infraDatabase && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Banco de Dados</label>
              <div className="text-sm bg-muted/30 rounded p-2 px-3 font-mono">
                {demand.infraDatabase}
              </div>
            </div>
          )}

          {/* Query SQL */}
          {demand.infraQuery && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Query SQL</label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={handleCopyQuery}
                >
                  <Copy size={11} className="mr-1" /> Copiar
                </Button>
              </div>
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto font-mono whitespace-pre-wrap break-all">
                {demand.infraQuery}
              </pre>
            </div>
          )}

          {/* Link da demanda */}
          {demand.infraExternalLink && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Link externo</label>
              <a
                href={demand.infraExternalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1.5 break-all"
              >
                <ExternalLink size={12} />
                {demand.infraExternalLink}
              </a>
            </div>
          )}

          {/* Anexos */}
          {demand.infraAttachments && demand.infraAttachments.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Paperclip size={12} /> Anexos ({demand.infraAttachments.length})
              </label>
              <div className="space-y-1.5">
                {demand.infraAttachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.dataUrl}
                    download={a.name}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 rounded border text-xs transition-colors"
                  >
                    <Paperclip size={12} className="text-muted-foreground" />
                    <span className="flex-1 truncate" title={a.name}>{a.name}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {a.size < 1024
                        ? `${a.size} B`
                        : a.size < 1024 * 1024
                        ? `${(a.size / 1024).toFixed(0)} KB`
                        : `${(a.size / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                    <Download size={12} className="text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InfraDemandSheet;
