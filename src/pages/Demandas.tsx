import { useState, useMemo, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Calendar, Signal, Users } from "lucide-react";
import { differenceInHours } from "date-fns";
import { getProcessedDemands, extractClientName } from "@/data/demandsLoader";
import { SlackDemand, DemandPriority, PRIORITY_CONFIG, ClosureFields, DemandCategory, SupportLevel, ExpirationReason, CATEGORY_OPTIONS } from "@/types/demand";
import { addBusinessHours, getFirstResponseMinutes, isExcludedFromFirstResponseSla } from "@/lib/businessHours";

function parseResponseSla(sla: string): number {
  const match = sla.match(/(\d+)\s*(min|hora|horas)/i);
  if (!match) return 60;
  const val = parseInt(match[1]);
  return match[2].startsWith("hora") ? val * 60 : val;
}
import DemandStats from "@/components/demandas/DemandStats";
import DemandFilters, { DemandFilterState, EMPTY_FILTERS } from "@/components/demandas/DemandFilters";
import DemandKanban from "@/components/demandas/DemandKanban";
import DemandByDate from "@/components/demandas/DemandByDate";
import DemandByPriority from "@/components/demandas/DemandByPriority";
import DemandByAssignee from "@/components/demandas/DemandByAssignee";
import DemandDetailSheet from "@/components/demandas/DemandDetailSheet";
import SyncStatusIndicator from "@/components/demandas/SyncStatusIndicator";
import ReportButton from "@/components/reports/ReportButton";

// === LOCAL PERSISTENCE ===
type DemandOverride = {
  status?: string;
  priority?: string;
  assignee?: string | null;
  completedAt?: string | null;
  manualStatusOverride?: boolean;
  closure?: Partial<ClosureFields>;
};

function loadOverrides(): Record<string, DemandOverride> {
  try {
    const stored = localStorage.getItem("fd_demand_overrides");
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function saveOverrides(overrides: Record<string, DemandOverride>) {
  localStorage.setItem("fd_demand_overrides", JSON.stringify(overrides));
}

function loadCustomAssignees(): string[] {
  try {
    const stored = localStorage.getItem("fd_custom_assignees");
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveCustomAssignees(assignees: string[]) {
  localStorage.setItem("fd_custom_assignees", JSON.stringify(assignees));
}

const Demandas = () => {
  const [demands, setDemands] = useState<SlackDemand[]>(() => getProcessedDemands());
  const [filters, setFilters] = useState<DemandFilterState>({ ...EMPTY_FILTERS });
  const [selected, setSelected] = useState<SlackDemand | null>(null);
  const [customAssignees, setCustomAssignees] = useState<string[]>(loadCustomAssignees);
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("fd_custom_categories") || "[]"); } catch { return []; }
  });

  const assignees = useMemo(() => {
    const set = new Set<string>(customAssignees);
    demands.forEach((d) => {
      if (d.assignee) set.add(d.assignee.name);
    });
    return Array.from(set).sort();
  }, [demands, customAssignees]);

  const allCategories = useMemo(() => {
    const base = [...CATEGORY_OPTIONS];
    customCategories.forEach((c) => { if (!base.includes(c as any)) base.push(c as any); });
    return base;
  }, [customCategories]);

  const handleAddAssignee = useCallback((name: string) => {
    setCustomAssignees((prev) => {
      if (prev.includes(name)) return prev;
      const updated = [...prev, name];
      saveCustomAssignees(updated);
      return updated;
    });
  }, []);

  const handleAddCategory = useCallback((name: string) => {
    setCustomCategories((prev) => {
      if (prev.includes(name)) return prev;
      const updated = [...prev, name];
      localStorage.setItem("fd_custom_categories", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clients = useMemo(() => {
    const set = new Set<string>();
    demands.forEach((d) => {
      const client = extractClientName(d.slackChannel);
      if (client !== d.slackChannel) set.add(client);
    });
    return Array.from(set).sort();
  }, [demands]);

  const handleAssigneeChange = useCallback((demandId: string, newAssignee: string | null) => {
    setDemands((prev) =>
      prev.map((d) =>
        d.id === demandId
          ? { ...d, assignee: newAssignee ? { name: newAssignee, avatar: "" } : null }
          : d
      )
    );
    setSelected((prev) =>
      prev && prev.id === demandId
        ? { ...prev, assignee: newAssignee ? { name: newAssignee, avatar: "" } : null }
        : prev
    );
    // Persist
    const overrides = loadOverrides();
    overrides[demandId] = { ...overrides[demandId], assignee: newAssignee };
    saveOverrides(overrides);
  }, []);

  const handlePriorityChange = useCallback((demandId: string, newPriority: DemandPriority) => {
    setDemands((prev) =>
      prev.map((d) => d.id === demandId ? { ...d, priority: newPriority } : d)
    );
    setSelected((prev) =>
      prev && prev.id === demandId ? { ...prev, priority: newPriority } : prev
    );
    const overrides = loadOverrides();
    overrides[demandId] = { ...overrides[demandId], priority: newPriority };
    saveOverrides(overrides);
  }, []);

  const handleStatusChange = useCallback((demandId: string, newStatus: string, completedAt?: string) => {
    const resolvedCompletedAt = newStatus === "concluida" ? (completedAt || new Date().toISOString()) : null;
    setDemands((prev) =>
      prev.map((d) =>
        d.id === demandId
          ? { ...d, status: newStatus as any, completedAt: newStatus === "concluida" ? resolvedCompletedAt : d.completedAt, manualStatusOverride: true }
          : d
      )
    );
    setSelected((prev) =>
      prev && prev.id === demandId
        ? { ...prev, status: newStatus as any, completedAt: newStatus === "concluida" ? resolvedCompletedAt : prev.completedAt, manualStatusOverride: true }
        : prev
    );
    const overrides = loadOverrides();
    overrides[demandId] = { ...overrides[demandId], status: newStatus, manualStatusOverride: true, completedAt: resolvedCompletedAt };
    saveOverrides(overrides);
  }, []);

  const handleClosureChange = useCallback((demandId: string, partial: Partial<ClosureFields>) => {
    setDemands((prev) =>
      prev.map((d) =>
        d.id === demandId
          ? { ...d, closure: { ...(d.closure || { category: "", expirationReason: "", supportLevel: "", internalComment: "", autoFilled: { category: false, expirationReason: false, supportLevel: false } }), ...partial } as ClosureFields }
          : d
      )
    );
    setSelected((prev) =>
      prev && prev.id === demandId
        ? { ...prev, closure: { ...(prev.closure || { category: "", expirationReason: "", supportLevel: "", internalComment: "", autoFilled: { category: false, expirationReason: false, supportLevel: false } }), ...partial } as ClosureFields }
        : prev
    );
    const overrides = loadOverrides();
    const existing = overrides[demandId] || {};
    overrides[demandId] = { ...existing, closure: { ...(existing as any).closure, ...partial } };
    saveOverrides(overrides);
  }, []);

  const handleStatClick = useCallback((statKey: string) => {
    setFilters((prev) => ({
      ...EMPTY_FILTERS,
      statFilter: prev.statFilter === statKey ? "" : statKey,
    }));
  }, []);

  // Demandas filtradas pelo período (para os quadros de stats)
  const periodFiltered = useMemo(() => {
    return demands.filter((d) => {
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(d.createdAt) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(d.createdAt) > to) return false;
      }
      return true;
    });
  }, [filters.dateFrom, filters.dateTo, demands]);

  const filtered = useMemo(() => {
    const now = new Date();

    return demands.filter((d) => {
      // Stat filter
      if (filters.statFilter) {
        switch (filters.statFilter) {
          case "abertas":
            if (d.status !== "aberta" && d.status !== "em_andamento") return false;
            break;
          case "urgentes":
            if (d.priority !== "p1" || d.status === "concluida") return false;
            break;
          case "vencendo": {
            if (d.status === "concluida" || d.status === "expirada") return false;
            const hoursLeft = differenceInHours(new Date(d.dueDate), now);
            if (hoursLeft < 0 || hoursLeft > 24) return false;
            break;
          }
          case "concluidas": {
            if (d.status !== "concluida") return false;
            break;
          }
          case "sla_estourado": {
            if (d.priority === "sem_classificacao") return false;
            const cfg = PRIORITY_CONFIG[d.priority];
            if (!cfg.sla) return false;
            if (d.status === "concluida" && d.completedAt) {
              const due = addBusinessHours(new Date(d.createdAt), cfg.sla.resolutionHours);
              if (new Date(d.completedAt) <= due) return false;
            } else if (d.status !== "expirada") {
              const due = addBusinessHours(new Date(d.createdAt), cfg.sla.resolutionHours);
              if (now <= due) return false;
            }
            break;
          }
          case "resposta_atrasada": {
            if (d.priority === "sem_classificacao") return false;
            if (isExcludedFromFirstResponseSla(d)) return false;
            const cfg2 = PRIORITY_CONFIG[d.priority];
            if (!cfg2.sla) return false;
            const mins = getFirstResponseMinutes(d.createdAt, d.threadReplies);
            const slaMinutes = parseResponseSla(cfg2.sla.response);
            if (mins === null) {
              const elapsed = (now.getTime() - new Date(d.createdAt).getTime()) / 60000;
              if (elapsed <= slaMinutes || d.status === "concluida") return false;
            } else {
              if (mins <= slaMinutes) return false;
            }
            break;
          }
        }
      }

      // Text search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          d.title.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.tags.some((t) => t.includes(q)) ||
          d.assignee?.name.toLowerCase().includes(q) ||
          extractClientName(d.slackChannel).toLowerCase().includes(q);
        if (!match) return false;
      }

      // Priority
      if (filters.priority !== "all" && d.priority !== filters.priority) return false;

      // Status
      if (filters.status !== "all" && d.status !== filters.status) return false;

      // Assignee
      if (filters.assignee && d.assignee?.name !== filters.assignee) return false;

      // Category
      if (filters.category !== "all" && d.closure?.category !== filters.category) return false;

      // Support Level
      if (filters.supportLevel !== "all" && d.closure?.supportLevel !== filters.supportLevel) return false;

      // Client
      if (filters.client && extractClientName(d.slackChannel) !== filters.client) return false;

      // Date range (based on createdAt)
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(d.createdAt) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(d.createdAt) > to) return false;
      }

      return true;
    });
  }, [filters, demands]);

  // SLA sort: estourados primeiro, depois por menor tempo restante até estouro
  const sorted = useMemo(() => {
    if (!filters.slaSort) return filtered;

    const now = new Date();

    function getSlaScore(d: SlackDemand): number {
      // Concluídas vão pro final
      if (d.status === "concluida") return Infinity;

      const cfg = PRIORITY_CONFIG[d.priority];
      if (!cfg.sla || d.priority === "sem_classificacao") return Infinity - 1;

      const dueDate = addBusinessHours(new Date(d.createdAt), cfg.sla.resolutionHours);
      const remainingMs = dueDate.getTime() - now.getTime();
      // Negativo = estourado (quanto mais negativo, mais estourado → menor score → aparece primeiro)
      return remainingMs;
    }

    return [...filtered].sort((a, b) => getSlaScore(a) - getSlaScore(b));
  }, [filtered, filters.slaSort]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm text-center sm:text-left">Acompanhe as demandas recebidas via Slack</p>
          </div>
          <div className="flex items-center gap-2">
            <ReportButton
              demands={sorted}
              source="demandas"
              filters={{
                ...(filters.priority !== "all" ? { Prioridade: filters.priority } : {}),
                ...(filters.status !== "all" ? { Status: filters.status } : {}),
                ...(filters.assignee ? { Responsável: filters.assignee } : {}),
                ...(filters.client ? { Cliente: filters.client } : {}),
                ...(filters.category !== "all" ? { Categoria: filters.category } : {}),
                ...(filters.dateFrom ? { "Data de": filters.dateFrom } : {}),
                ...(filters.dateTo ? { "Data até": filters.dateTo } : {}),
                ...(filters.statFilter ? { Filtro: filters.statFilter } : {}),
              }}
            />
            <SyncStatusIndicator />
          </div>
        </div>

        {/* Stats - clicaveis */}
        <DemandStats
          demands={periodFiltered}
          activeFilter={filters.statFilter}
          onFilterClick={handleStatClick}
        />

        {/* Filters */}
        <DemandFilters
          filters={filters}
          onChange={setFilters}
          assignees={assignees}
          clients={clients}
        />

        {/* Tabs */}
        <Tabs defaultValue="kanban">
          <TabsList className="mb-4 w-full sm:w-auto flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="kanban" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3">
              <LayoutGrid size={14} /> <span className="hidden sm:inline">Visao</span> Geral
            </TabsTrigger>
            <TabsTrigger value="date" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3">
              <Calendar size={14} /> <span className="hidden sm:inline">Por</span> Data
            </TabsTrigger>
            <TabsTrigger value="priority" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3">
              <Signal size={14} /> <span className="hidden sm:inline">Por</span> Prior.
            </TabsTrigger>
            <TabsTrigger value="assignee" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3">
              <Users size={14} /> <span className="hidden sm:inline">Por</span> Resp.
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            <DemandKanban demands={sorted} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="date">
            <DemandByDate demands={sorted} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="priority">
            <DemandByPriority demands={sorted} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="assignee">
            <DemandByAssignee demands={sorted} onSelect={setSelected} />
          </TabsContent>
        </Tabs>

        {/* Detail sheet */}
        <DemandDetailSheet
          demand={selected}
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          assignees={assignees}
          onAssigneeChange={handleAssigneeChange}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onAddAssignee={handleAddAssignee}
          onClosureChange={handleClosureChange}
          categories={allCategories}
          onAddCategory={handleAddCategory}
        />
      </div>
    </AppLayout>
  );
};

export default Demandas;
