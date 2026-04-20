import { useState, useMemo, useCallback, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Database, Inbox, Clock, CheckCircle2, Loader2, Search, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SlackDemand, ClosureFields, DemandPriority, CATEGORY_OPTIONS, DemandCategory } from "@/types/demand";
import { getProcessedSqlDemands } from "@/data/sqlDemandsLoader";
import {
  getAverageHandlingMinutes,
  getAverageInProgressMinutes,
  formatHandlingTime,
} from "@/lib/sqlSla";
import SqlDemandList from "@/components/demandas/SqlDemandList";
import DemandKanban from "@/components/demandas/DemandKanban";
import DemandByDate from "@/components/demandas/DemandByDate";
import DemandByAssignee from "@/components/demandas/DemandByAssignee";
import DemandDetailSheet from "@/components/demandas/DemandDetailSheet";
import ReportButton from "@/components/reports/ReportButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Calendar, Users } from "lucide-react";

// === Overrides LOCAIS do modulo SQL (chave isolada) ===
const SQL_OVERRIDES_KEY = "fd_sql_demand_overrides";

type SqlOverride = {
  status?: string;
  completedAt?: string | null;
  approvedAt?: string | null;
  manualStatusOverride?: boolean;
  assignee?: string | null;
  closure?: Partial<ClosureFields>;
};

function loadSqlOverrides(): Record<string, SqlOverride> {
  try {
    const raw = localStorage.getItem(SQL_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSqlOverrides(ov: Record<string, SqlOverride>) {
  localStorage.setItem(SQL_OVERRIDES_KEY, JSON.stringify(ov));
}

const DemandasSql = () => {
  const [demands, setDemands] = useState<SlackDemand[]>(() => getProcessedSqlDemands());
  const [selected, setSelected] = useState<SlackDemand | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("lista");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [customAssignees, setCustomAssignees] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem("fd_sql_custom_assignees");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [customCategories, setCustomCategories] = useState<DemandCategory[]>([...CATEGORY_OPTIONS]);
  const { toast } = useToast();

  // Lista unica de assignees (dos dados + custom)
  const assignees = useMemo(() => {
    const set = new Set<string>(customAssignees);
    for (const d of demands) {
      if (d.assignee?.name) set.add(d.assignee.name);
    }
    return Array.from(set).sort();
  }, [demands, customAssignees]);

  // Recarrega demands se os dados mudarem (depois de sync)
  const reloadDemands = useCallback(() => {
    setDemands(getProcessedSqlDemands());
  }, []);

  // === SYNC SOB DEMANDA (forca sync + rebuild + reload automatico) ===
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/__sync-sql", { method: "POST" });
      const result = await res.json();
      if (result.ok) {
        toast({
          title: "Demandas atualizadas",
          description: "Recarregando a página...",
        });
        setLastSync(new Date());
        // Recarrega para exibir o bundle novo com dados atualizados.
        // Pequeno delay para o toast aparecer antes do reload.
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        toast({
          title: "Erro ao sincronizar",
          description:
            result.error ||
            (result.stage === "build"
              ? "Sync OK, mas o rebuild falhou."
              : result.stderr) ||
            "Tente novamente.",
          variant: "destructive",
        });
        setSyncing(false);
      }
    } catch (err) {
      toast({
        title: "Erro de rede",
        description: String(err),
        variant: "destructive",
      });
      setSyncing(false);
    }
  };

  // === HANDLERS de mudança de status / assignee ===
  const openDemand = useCallback((d: SlackDemand) => {
    setSelected(d);
    setDetailOpen(true);
  }, []);

  const handleStatusChange = useCallback(
    (demandId: string, newStatus: string, resolvedCompletedAt?: string) => {
      const completedAt = resolvedCompletedAt ?? null;
      setDemands((prev) =>
        prev.map((d) =>
          d.id === demandId
            ? { ...d, status: newStatus as SlackDemand["status"], completedAt, manualStatusOverride: true }
            : d
        )
      );
      setSelected((prev) =>
        prev && prev.id === demandId
          ? { ...prev, status: newStatus as SlackDemand["status"], completedAt, manualStatusOverride: true }
          : prev
      );
      const overrides = loadSqlOverrides();
      overrides[demandId] = {
        ...overrides[demandId],
        status: newStatus,
        manualStatusOverride: true,
        completedAt,
      };
      saveSqlOverrides(overrides);
    },
    []
  );

  const handlePriorityChange = useCallback((demandId: string, priority: DemandPriority) => {
    setDemands((prev) => prev.map((d) => (d.id === demandId ? { ...d, priority } : d)));
    setSelected((prev) => (prev && prev.id === demandId ? { ...prev, priority } : prev));
  }, []);

  const handleClosureChange = useCallback((demandId: string, partial: Partial<ClosureFields>) => {
    setDemands((prev) =>
      prev.map((d) =>
        d.id === demandId
          ? {
              ...d,
              closure: {
                ...(d.closure || {
                  category: "",
                  expirationReason: "",
                  supportLevel: "",
                  internalComment: "",
                  autoFilled: { category: false, expirationReason: false, supportLevel: false },
                }),
                ...partial,
              } as ClosureFields,
            }
          : d
      )
    );
    const overrides = loadSqlOverrides();
    const existing = overrides[demandId] || {};
    overrides[demandId] = { ...existing, closure: { ...(existing.closure || {}), ...partial } };
    saveSqlOverrides(overrides);
  }, []);

  const handleAddAssignee = useCallback((name: string) => {
    setCustomAssignees((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      localStorage.setItem("fd_sql_custom_assignees", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleAddCategory = useCallback((name: string) => {
    setCustomCategories((prev) => {
      if ((prev as string[]).includes(name)) return prev;
      return [...prev, name as DemandCategory];
    });
  }, []);

  const handleAssigneeChange = useCallback((demandId: string, assignee: string | null) => {
    setDemands((prev) =>
      prev.map((d) =>
        d.id === demandId ? { ...d, assignee: assignee ? { name: assignee, avatar: "" } : null } : d
      )
    );
    setSelected((prev) =>
      prev && prev.id === demandId ? { ...prev, assignee: assignee ? { name: assignee, avatar: "" } : null } : prev
    );
    const overrides = loadSqlOverrides();
    overrides[demandId] = { ...overrides[demandId], assignee };
    saveSqlOverrides(overrides);
  }, []);

  // === Filtros ===
  const filtered = useMemo(() => {
    return demands.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !d.title.toLowerCase().includes(q) &&
          !d.description.toLowerCase().includes(q) &&
          !d.requester.name.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [demands, statusFilter, search]);

  // === Stats ===
  const stats = useMemo(() => {
    const abertas = demands.filter((d) => d.status === "aberta").length;
    const andamento = demands.filter((d) => d.status === "em_andamento").length;
    const concluidas = demands.filter((d) => d.status === "concluida").length;
    const avgHandling = getAverageHandlingMinutes(demands);
    const avgInProgress = getAverageInProgressMinutes(demands);
    return {
      abertas,
      andamento,
      concluidas,
      total: demands.length,
      avgHandling,
      avgInProgress,
    };
  }, [demands]);


  // Recarrega automaticamente quando a janela ganha foco (caso outro sync tenha rolado)
  useEffect(() => {
    const onFocus = () => reloadDemands();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadDemands]);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Database className="text-primary" size={22} />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Demandas SQL</h1>
              <p className="text-xs text-muted-foreground">
                Canal #operacoes-sql · isolado dos demais relatórios
                {lastSync && ` · última sync: ${lastSync.toLocaleTimeString("pt-BR")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="gap-1.5"
            >
              {syncing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Atualizar"}</span>
            </Button>
            <ReportButton demands={filtered} source="demandas" filters={{ modulo: "SQL" }} />
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card
            className="border border-border shadow-sm cursor-pointer hover:shadow-md transition-all"
            onClick={() => setStatusFilter("all")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted shrink-0">
                <Database size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border border-border shadow-sm cursor-pointer hover:shadow-md transition-all ${
              statusFilter === "aberta" ? "ring-2 ring-primary/30 shadow-md" : ""
            }`}
            onClick={() => setStatusFilter(statusFilter === "aberta" ? "all" : "aberta")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                <Inbox size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.abertas}</p>
                <p className="text-xs text-muted-foreground">Abertas</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border border-border shadow-sm cursor-pointer hover:shadow-md transition-all ${
              statusFilter === "em_andamento" ? "ring-2 ring-warning/30 shadow-md" : ""
            }`}
            onClick={() => setStatusFilter(statusFilter === "em_andamento" ? "all" : "em_andamento")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/10 shrink-0">
                <Clock size={18} className="text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.andamento}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border border-border shadow-sm cursor-pointer hover:shadow-md transition-all ${
              statusFilter === "concluida" ? "ring-2 ring-success/30 shadow-md" : ""
            }`}
            onClick={() => setStatusFilter(statusFilter === "concluida" ? "all" : "concluida")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-success/10 shrink-0">
                <CheckCircle2 size={18} className="text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.concluidas}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
            </CardContent>
          </Card>

          {/* SLA - Tempo medio de atendimento (concluidas) */}
          <Card className="border border-border shadow-sm" title="Tempo medio entre a aprovacao e a conclusao (SLA)">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-info/10 shrink-0">
                <Timer size={18} className="text-info" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{formatHandlingTime(stats.avgHandling)}</p>
                <p className="text-xs text-muted-foreground">Tempo médio SLA</p>
              </div>
            </CardContent>
          </Card>

          {/* Tempo medio das que estao em andamento */}
          <Card className="border border-border shadow-sm" title="Tempo medio desde a aprovacao para demandas em andamento">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/10 shrink-0">
                <Clock size={18} className="text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{formatHandlingTime(stats.avgInProgress)}</p>
                <p className="text-xs text-muted-foreground">Em atendimento</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, descrição ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="aberta">Abertas</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Visualizações */}
        {demands.length === 0 ? (
          <Card className="border border-border shadow-sm">
            <CardContent className="p-12 flex flex-col items-center text-center gap-3">
              <Database size={40} className="text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Nenhuma demanda carregada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Atualizar" para sincronizar o canal #operacoes-sql.
                </p>
              </div>
              <Button onClick={handleSync} disabled={syncing} className="mt-2 gap-2">
                {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="lista" className="gap-1.5">
                <LayoutGrid size={14} /> Lista
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5">
                <LayoutGrid size={14} /> Kanban
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-1.5">
                <Calendar size={14} /> Por Data
              </TabsTrigger>
              <TabsTrigger value="resp" className="gap-1.5">
                <Users size={14} /> Por Responsável
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lista" className="mt-4">
              <SqlDemandList demands={filtered} onSelect={openDemand} />
            </TabsContent>
            <TabsContent value="kanban" className="mt-4">
              <DemandKanban demands={filtered} onSelect={openDemand} />
            </TabsContent>
            <TabsContent value="data" className="mt-4">
              <DemandByDate demands={filtered} onSelect={openDemand} />
            </TabsContent>
            <TabsContent value="resp" className="mt-4">
              <DemandByAssignee demands={filtered} onSelect={openDemand} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <DemandDetailSheet
        demand={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        assignees={assignees}
        onAssigneeChange={handleAssigneeChange}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onAddAssignee={handleAddAssignee}
        onClosureChange={handleClosureChange}
        categories={customCategories}
        onAddCategory={handleAddCategory}
      />
    </AppLayout>
  );
};

export default DemandasSql;
