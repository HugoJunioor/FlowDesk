/**
 * Modulo Infra — demandas INTERNAS (sem Slack).
 *
 * Time abre demandas direto no FlowDesk via formulario. Os 2 tipos sao:
 * - SQL (operacoes SQL)
 * - Deploy (release/deploy)
 *
 * Persistencia em data/infraDemands.json via apiClient.infra.
 * Responsavel padrao: Tiago Silva. Prioridade padrao: P3.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Database, Rocket, Inbox, Loader2, Clock, CheckCircle2, AlertCircle, Trash2, Copy, ExternalLink, Wrench, Paperclip, Download, ListFilter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { SlackDemand, PRIORITY_CONFIG } from "@/types/demand";
import NewInfraDemandModal from "@/components/infra/NewInfraDemandModal";
import InfraDemandSheet from "@/components/infra/InfraDemandSheet";
import { notifyStarted, notifyCompleted } from "@/lib/notificationEvents";
import StaleBadge from "@/components/demandas/StaleBadge";

/** Filtro por status — exibido como cards (quadros) clicaveis */
type StatusFilter = "todas" | "novas" | "em_andamento" | "em_atraso" | "concluidas";
/** Filtro por tipo — chips toggleable que combinam com o status */
type KindFilter = "todos" | "sql" | "deploy";

function isOverdue(d: SlackDemand): boolean {
  if (d.status === "concluida") return false;
  if (!d.dueDate) return false;
  return new Date(d.dueDate) < new Date();
}

function priorityLabel(p: SlackDemand["priority"]) {
  return PRIORITY_CONFIG[p]?.shortLabel ?? "—";
}

function priorityColor(p: SlackDemand["priority"]) {
  if (p === "p1") return "bg-destructive/10 text-destructive border-destructive/30";
  if (p === "p2") return "bg-warning/10 text-warning border-warning/30";
  if (p === "p3") return "bg-info/10 text-info border-info/30";
  return "bg-muted text-muted-foreground border-border";
}

function statusBadge(s: SlackDemand["status"]) {
  const map = {
    aberta: { label: "Aberta", cls: "bg-warning/10 text-warning border-warning/30", icon: AlertCircle },
    em_andamento: { label: "Em andamento", cls: "bg-info/10 text-info border-info/30", icon: Loader2 },
    concluida: { label: "Concluída", cls: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
    expirada: { label: "Expirada", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: Clock },
  };
  return map[s] ?? map.aberta;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

const Infra = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [demands, setDemands] = useState<SlackDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [kindFilter, setKindFilter] = useState<KindFilter>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultKind, setModalDefaultKind] = useState<"sql" | "deploy">("sql");
  const [selectedDemand, setSelectedDemand] = useState<SlackDemand | null>(null);

  // Abre Sheet automaticamente se ?openId=<id> na URL (vindo de notificacao)
  useEffect(() => {
    const openId = searchParams.get("openId");
    if (!openId || demands.length === 0) return;
    const found = demands.find((d) => d.id === openId);
    if (found) {
      setSelectedDemand(found);
      // Remove o param da URL pra nao reabrir ao fechar o sheet
      const next = new URLSearchParams(searchParams);
      next.delete("openId");
      setSearchParams(next, { replace: true });
    }
  }, [demands, searchParams, setSearchParams]);

  // Snapshot do ultimo fetch — usado pra detectar mudancas no polling
  // (sem disparar toast na primeira carga).
  const lastSnapshotRef = useRef<Map<string, SlackDemand> | null>(null);

  /**
   * Compara snapshot anterior com novo fetch e dispara toasts pras mudancas
   * relevantes: demanda nova, status mudou, ou demanda excluida.
   */
  const diffAndNotify = useCallback((next: SlackDemand[]) => {
    const prev = lastSnapshotRef.current;
    if (!prev) return; // primeira carga, nao notifica
    const nextMap = new Map(next.map((d) => [d.id, d]));

    // Novas
    for (const d of next) {
      if (!prev.has(d.id)) {
        toast({
          title: "Nova demanda Infra",
          description: `${d.infraKind === "deploy" ? "Deploy" : "SQL"} · ${d.title}`,
        });
      }
    }
    // Mudancas de status
    for (const d of next) {
      const old = prev.get(d.id);
      if (old && old.status !== d.status) {
        toast({
          title: `Status alterado: ${d.title}`,
          description: `${old.status} → ${d.status}`,
        });
      }
    }
    // Excluidas
    for (const id of prev.keys()) {
      if (!nextMap.has(id)) {
        const old = prev.get(id);
        if (old) {
          toast({
            title: "Demanda excluída",
            description: old.title,
          });
        }
      }
    }
  }, [toast]);

  const reload = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const res = await apiClient.infra.list();
      const next = res.demands || [];
      // So compara/notifica em polling silencioso (auto-refresh)
      if (opts.silent) diffAndNotify(next);
      setDemands(next);
      lastSnapshotRef.current = new Map(next.map((d) => [d.id, d]));
    } catch (e) {
      // Erros silenciosos durante polling pra nao floodar o user
      if (!opts.silent) {
        toast({
          title: "Erro ao carregar demandas",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [toast, diffAndNotify]);

  // Primeira carga
  useEffect(() => { void reload(); }, [reload]);

  // Polling a cada 10s pra detectar mudancas vindas de outros usuarios/abas
  useEffect(() => {
    const id = setInterval(() => { void reload({ silent: true }); }, 10_000);
    return () => clearInterval(id);
  }, [reload]);

  // Aplica primeiro o filtro de tipo (SQL/Deploy/Todos), depois o de status.
  // Assim os contadores dos quadros refletem a selecao de tipo atual.
  const byKind = demands.filter((d) => {
    if (kindFilter === "todos") return true;
    return d.infraKind === kindFilter;
  });

  const filtered = byKind.filter((d) => {
    switch (statusFilter) {
      case "todas": return true;
      case "novas": return d.status === "aberta";
      case "em_andamento": return d.status === "em_andamento";
      case "em_atraso": return isOverdue(d);
      case "concluidas": return d.status === "concluida";
      default: return true;
    }
  });

  // Counters dos quadros — refletem o filtro de tipo
  const counts = {
    todas: byKind.length,
    novas: byKind.filter(d => d.status === "aberta").length,
    em_andamento: byKind.filter(d => d.status === "em_andamento").length,
    em_atraso: byKind.filter(isOverdue).length,
    concluidas: byKind.filter(d => d.status === "concluida").length,
    sql: demands.filter(d => d.infraKind === "sql").length,
    deploy: demands.filter(d => d.infraKind === "deploy").length,
  };

  const handleAttend = async (d: SlackDemand) => {
    try {
      await apiClient.infra.update(d.id, { status: "em_andamento" });
      void notifyStarted(d, currentUser?.name);
      toast({ title: "Demanda em atendimento" });
      void reload();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleConclude = async (d: SlackDemand) => {
    try {
      await apiClient.infra.update(d.id, { status: "concluida" });
      void notifyCompleted(d, currentUser?.name);
      toast({ title: "Demanda concluída" });
      void reload();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (d: SlackDemand) => {
    if (!confirm(`Excluir demanda "${d.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await apiClient.infra.remove(d.id);
      toast({ title: "Demanda excluída" });
      void reload();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleCopyQuery = async (d: SlackDemand) => {
    const q = d.infraQuery || "";
    if (!q) return;
    try {
      await navigator.clipboard.writeText(q);
      toast({ title: "Query copiada", description: `${q.length} caracteres` });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const openModal = (kind: "sql" | "deploy") => {
    setModalDefaultKind(kind);
    setModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Wrench size={22} className="text-primary" /> Infra
            </h1>
            <p className="text-sm text-muted-foreground">Demandas internas de Operações SQL e Deploy</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => openModal("sql")} variant="outline" className="gap-2">
              <Database size={14} /> Nova SQL
            </Button>
            <Button onClick={() => openModal("deploy")} className="gap-2">
              <Rocket size={14} /> Novo Deploy
            </Button>
          </div>
        </div>

        {/* Quadros (KPI cards) — filtro por STATUS. Clicar alterna. */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatusCard
            label="Todas"
            count={counts.todas}
            icon={ListFilter}
            active={statusFilter === "todas"}
            onClick={() => setStatusFilter("todas")}
          />
          <StatusCard
            label="Novas"
            count={counts.novas}
            icon={AlertCircle}
            tint="warning"
            active={statusFilter === "novas"}
            onClick={() => setStatusFilter("novas")}
          />
          <StatusCard
            label="Em andamento"
            count={counts.em_andamento}
            icon={Loader2}
            tint="info"
            active={statusFilter === "em_andamento"}
            onClick={() => setStatusFilter("em_andamento")}
          />
          <StatusCard
            label="Em atraso"
            count={counts.em_atraso}
            icon={Clock}
            tint="destructive"
            active={statusFilter === "em_atraso"}
            onClick={() => setStatusFilter("em_atraso")}
          />
          <StatusCard
            label="Concluídas"
            count={counts.concluidas}
            icon={CheckCircle2}
            tint="success"
            active={statusFilter === "concluidas"}
            onClick={() => setStatusFilter("concluidas")}
          />
        </div>

        {/* Chips de filtro por TIPO — combina com o status selecionado acima */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ListFilter size={12} /> Tipo:
          </span>
          <KindChip
            label="Todos"
            count={demands.length}
            active={kindFilter === "todos"}
            onClick={() => setKindFilter("todos")}
          />
          <KindChip
            label="SQL"
            icon={Database}
            count={counts.sql}
            active={kindFilter === "sql"}
            onClick={() => setKindFilter("sql")}
          />
          <KindChip
            label="Deploy"
            icon={Rocket}
            count={counts.deploy}
            active={kindFilter === "deploy"}
            onClick={() => setKindFilter("deploy")}
          />
        </div>

        {/* Lista de demandas (uma abaixo da outra) */}
        <div className="mt-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="animate-spin mr-2" size={16} /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Inbox size={32} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {statusFilter === "todas" && kindFilter === "todos" && "Nenhuma demanda cadastrada"}
                    {statusFilter === "novas" && "Nenhuma demanda aberta no momento"}
                    {statusFilter === "em_andamento" && "Nenhuma demanda em andamento"}
                    {statusFilter === "em_atraso" && "Tudo em dia — nenhuma demanda em atraso ✨"}
                    {statusFilter === "concluidas" && "Nenhuma demanda concluída ainda"}
                    {statusFilter === "todas" && kindFilter === "sql" && "Nenhuma demanda de SQL"}
                    {statusFilter === "todas" && kindFilter === "deploy" && "Nenhuma demanda de Deploy"}
                  </p>
                  {statusFilter === "todas" && kindFilter === "todos" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Clique em "Nova SQL" ou "Novo Deploy" pra abrir.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((d) => {
                  const sb = statusBadge(d.status);
                  return (
                    <Card
                      key={d.id}
                      className="hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => setSelectedDemand(d)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border ${priorityColor(d.priority)}`}>
                            {priorityLabel(d.priority)}
                          </div>
                          <div className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium border ${sb.cls}`}>
                            {sb.label}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground truncate flex-1">{d.title}</p>
                              {d.infraExternalLink && (
                                <a
                                  href={d.infraExternalLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-primary hover:underline flex items-center gap-0.5 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                  title={d.infraExternalLink}
                                >
                                  <ExternalLink size={10} /> Link
                                </a>
                              )}
                            </div>
                            {d.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                            )}
                            {/* Banco + preview da query/script (ambos tipos) */}
                            {(d.infraDatabase || d.infraQuery) && (
                              <div className="mt-2 flex items-start gap-2 flex-wrap">
                                {d.infraDatabase && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted border font-mono">
                                    {d.infraDatabase}
                                  </span>
                                )}
                                {d.infraQuery && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleCopyQuery(d); }}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted border hover:bg-muted/70 flex items-center gap-1 font-mono"
                                    title={d.infraQuery}
                                  >
                                    <Copy size={9} /> Copiar ({d.infraQuery.length} chars)
                                  </button>
                                )}
                              </div>
                            )}
                            {/* Anexos (download direto clicando) */}
                            {d.infraAttachments && d.infraAttachments.length > 0 && (
                              <div className="mt-2 flex items-start gap-1.5 flex-wrap">
                                {d.infraAttachments.map((a) => (
                                  <a
                                    key={a.id}
                                    href={a.dataUrl}
                                    download={a.name}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted border hover:bg-muted/70 flex items-center gap-1"
                                    title={`${a.name} (${(a.size / 1024).toFixed(0)} KB)`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Paperclip size={9} />
                                    <span className="truncate max-w-[120px]">{a.name}</span>
                                    <Download size={9} className="text-muted-foreground" />
                                  </a>
                                ))}
                              </div>
                            )}
                            {/* Data limite — destaca se passou */}
                            {d.dueDate && d.status !== "concluida" && (
                              (() => {
                                const due = new Date(d.dueDate);
                                const overdue = due < new Date();
                                return (
                                  <div className={`text-[10px] mt-1.5 flex items-center gap-1 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                    <Clock size={10} />
                                    Prazo: {due.toLocaleDateString("pt-BR")} {String(due.getHours()).padStart(2, "0")}:{String(due.getMinutes()).padStart(2, "0")}
                                    {overdue && " (vencido)"}
                                  </div>
                                );
                              })()
                            )}
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                {d.infraKind === "deploy" ? <Rocket size={11} /> : <Database size={11} />}
                                {d.infraKind === "deploy" ? "Deploy" : "SQL"}
                              </span>
                              <span>•</span>
                              <span>Aberto por <strong className="text-foreground">{d.requester.name}</strong></span>
                              <span>•</span>
                              <span>Atribuído a <strong className="text-foreground">{d.assignee?.name ?? "—"}</strong></span>
                              <span>•</span>
                              <span>{formatRelativeDate(d.createdAt)}</span>
                              <StaleBadge demand={d} className="ml-auto" />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {d.status === "aberta" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); handleAttend(d); }}
                              >
                                Atender
                              </Button>
                            )}
                            {d.status !== "concluida" && (
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleConclude(d); }}
                              >
                                Concluir
                              </Button>
                            )}
                            {currentUser?.role === "master" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleDelete(d); }}
                                title="Excluir"
                              >
                                <Trash2 size={14} className="text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Modal de criar */}
      <NewInfraDemandModal
        open={modalOpen}
        defaultKind={modalDefaultKind}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          void reload();
        }}
      />

      {/* Sheet de detalhe da demanda */}
      <InfraDemandSheet
        demand={selectedDemand}
        open={!!selectedDemand}
        onClose={() => setSelectedDemand(null)}
        onChanged={() => {
          // Refresh + atualiza demanda selecionada. Usa reload pra manter
          // o snapshot do polling sincronizado e nao disparar toasts
          // pras mudancas que o proprio user acabou de fazer.
          void apiClient.infra.list().then((res) => {
            const next = res.demands || [];
            setDemands(next);
            lastSnapshotRef.current = new Map(next.map((d) => [d.id, d]));
            if (selectedDemand) {
              const updated = next.find((d) => d.id === selectedDemand.id);
              setSelectedDemand(updated ?? null);
            }
          });
        }}
      />
    </AppLayout>
  );
};

// ============= Helpers visuais =============

type Tint = "default" | "warning" | "info" | "destructive" | "success";

interface StatusCardProps {
  label: string;
  count: number;
  icon: typeof AlertCircle;
  tint?: Tint;
  active: boolean;
  onClick: () => void;
}

function StatusCard({ label, count, icon: Icon, tint = "default", active, onClick }: StatusCardProps) {
  const tintMap: Record<Tint, { text: string; border: string; bg: string }> = {
    default: { text: "text-foreground", border: "border-border", bg: "bg-muted/40" },
    warning: { text: "text-warning", border: "border-warning/30", bg: "bg-warning/10" },
    info: { text: "text-info", border: "border-info/30", bg: "bg-info/10" },
    destructive: { text: "text-destructive", border: "border-destructive/30", bg: "bg-destructive/10" },
    success: { text: "text-success", border: "border-success/30", bg: "bg-success/10" },
  };
  const t = tintMap[tint];
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg p-3 border transition-all ${
        active
          ? `${t.bg} ${t.border} ring-2 ring-primary/30`
          : `bg-card border-border hover:${t.bg} hover:${t.border}`
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </span>
        <Icon size={14} className={t.text} />
      </div>
      <div className={`text-2xl font-bold mt-1 ${active ? t.text : "text-foreground"}`}>
        {count}
      </div>
    </button>
  );
}

interface KindChipProps {
  label: string;
  count: number;
  icon?: typeof Database;
  active: boolean;
  onClick: () => void;
}

function KindChip({ label, count, icon: Icon, active, onClick }: KindChipProps) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
      }`}
    >
      {Icon && <Icon size={12} />}
      {label}
      <span className={`text-[10px] ${active ? "opacity-90" : "opacity-70"}`}>({count})</span>
    </button>
  );
}

export default Infra;
