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
import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Database, Rocket, Inbox, Loader2, Clock, CheckCircle2, AlertCircle, Trash2, Copy, ExternalLink, Wrench, Paperclip, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { SlackDemand, PRIORITY_CONFIG } from "@/types/demand";
import NewInfraDemandModal from "@/components/infra/NewInfraDemandModal";
import InfraDemandSheet from "@/components/infra/InfraDemandSheet";

type Tab = "todas" | "novas" | "em_andamento" | "em_atraso" | "concluidas" | "sql" | "deploy";

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
  const [demands, setDemands] = useState<SlackDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultKind, setModalDefaultKind] = useState<"sql" | "deploy">("sql");
  const [selectedDemand, setSelectedDemand] = useState<SlackDemand | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.infra.list();
      setDemands(res.demands || []);
    } catch (e) {
      toast({
        title: "Erro ao carregar demandas",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = demands.filter((d) => {
    switch (activeTab) {
      case "todas": return true;
      case "novas": return d.status === "aberta";
      case "em_andamento": return d.status === "em_andamento";
      case "em_atraso": return isOverdue(d);
      case "concluidas": return d.status === "concluida";
      case "sql": return d.infraKind === "sql";
      case "deploy": return d.infraKind === "deploy";
      default: return true;
    }
  });

  // Counters reutilizaveis
  const counts = {
    todas: demands.length,
    novas: demands.filter(d => d.status === "aberta").length,
    em_andamento: demands.filter(d => d.status === "em_andamento").length,
    em_atraso: demands.filter(isOverdue).length,
    concluidas: demands.filter(d => d.status === "concluida").length,
    sql: demands.filter(d => d.infraKind === "sql").length,
    deploy: demands.filter(d => d.infraKind === "deploy").length,
  };

  const handleAttend = async (d: SlackDemand) => {
    try {
      await apiClient.infra.update(d.id, { status: "em_andamento" });
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

        {/* Tabs — primeira linha = por status, segunda = por tipo */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="space-y-2">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="todas">
              Todas <span className="ml-2 text-xs text-muted-foreground">({counts.todas})</span>
            </TabsTrigger>
            <TabsTrigger value="novas">
              <AlertCircle size={12} className="mr-1.5 text-warning" />
              Novas <span className="ml-2 text-xs text-muted-foreground">({counts.novas})</span>
            </TabsTrigger>
            <TabsTrigger value="em_andamento">
              <Loader2 size={12} className="mr-1.5 text-info" />
              Em andamento <span className="ml-2 text-xs text-muted-foreground">({counts.em_andamento})</span>
            </TabsTrigger>
            <TabsTrigger value="em_atraso" className={counts.em_atraso > 0 ? "text-destructive" : ""}>
              <Clock size={12} className="mr-1.5" />
              Em atraso <span className="ml-2 text-xs">({counts.em_atraso})</span>
            </TabsTrigger>
            <TabsTrigger value="concluidas">
              <CheckCircle2 size={12} className="mr-1.5 text-success" />
              Concluídas <span className="ml-2 text-xs text-muted-foreground">({counts.concluidas})</span>
            </TabsTrigger>
            <span className="w-px h-5 bg-border mx-1" />
            <TabsTrigger value="sql">
              <Database size={12} className="mr-1.5" />
              SQL <span className="ml-2 text-xs text-muted-foreground">({counts.sql})</span>
            </TabsTrigger>
            <TabsTrigger value="deploy">
              <Rocket size={12} className="mr-1.5" />
              Deploy <span className="ml-2 text-xs text-muted-foreground">({counts.deploy})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="animate-spin mr-2" size={16} /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Inbox size={32} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "todas" && "Nenhuma demanda cadastrada"}
                    {activeTab === "novas" && "Nenhuma demanda aberta no momento"}
                    {activeTab === "em_andamento" && "Nenhuma demanda em andamento"}
                    {activeTab === "em_atraso" && "Tudo em dia — nenhuma demanda em atraso ✨"}
                    {activeTab === "concluidas" && "Nenhuma demanda concluída ainda"}
                    {activeTab === "sql" && "Nenhuma demanda de SQL"}
                    {activeTab === "deploy" && "Nenhuma demanda de Deploy"}
                  </p>
                  {activeTab === "todas" && (
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
          </TabsContent>
        </Tabs>
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
          // Refresh + atualiza demanda selecionada
          void apiClient.infra.list().then((res) => {
            setDemands(res.demands || []);
            if (selectedDemand) {
              const updated = (res.demands || []).find((d) => d.id === selectedDemand.id);
              setSelectedDemand(updated ?? null);
            }
          });
        }}
      />
    </AppLayout>
  );
};

export default Infra;
