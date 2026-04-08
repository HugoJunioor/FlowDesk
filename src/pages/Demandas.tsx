import { useState, useMemo, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Calendar, Signal, Users } from "lucide-react";
import { differenceInHours } from "date-fns";
import { baseDemands, extractClientName } from "@/data/demandsLoader";
import { SlackDemand, DemandPriority, PRIORITY_CONFIG, ClosureFields, DemandCategory, SupportLevel, ExpirationReason, CATEGORY_OPTIONS } from "@/types/demand";
import { addBusinessHours, getFirstResponseMinutes } from "@/lib/businessHours";

function parseResponseSla(sla: string): number {
  const match = sla.match(/(\d+)\s*(min|hora|horas)/i);
  if (!match) return 60;
  const val = parseInt(match[1]);
  return match[2].startsWith("hora") ? val * 60 : val;
}
import { classifyDemand } from "@/lib/priorityClassifier";
import { processDemandsStatus } from "@/lib/statusAnalyzer";
import { classifyClosureFields, generateBlankFieldsReport } from "@/lib/closureClassifier";
import DemandStats from "@/components/demandas/DemandStats";
import DemandFilters, { DemandFilterState, EMPTY_FILTERS } from "@/components/demandas/DemandFilters";
import DemandKanban from "@/components/demandas/DemandKanban";
import DemandByDate from "@/components/demandas/DemandByDate";
import DemandByPriority from "@/components/demandas/DemandByPriority";
import DemandByAssignee from "@/components/demandas/DemandByAssignee";
import DemandDetailSheet from "@/components/demandas/DemandDetailSheet";
import SyncStatusIndicator from "@/components/demandas/SyncStatusIndicator";

// === LOCAL PERSISTENCE ===
// Overrides: { [demandId]: { status?, priority?, assignee?, completedAt? } }
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

// Apply saved overrides to demands
function applyOverrides(demands: SlackDemand[]): SlackDemand[] {
  const overrides = loadOverrides();
  return demands.map((d) => {
    const ov = overrides[d.id];
    if (!ov) return d;
    return {
      ...d,
      status: (ov.status as any) || d.status,
      priority: (ov.priority as any) || d.priority,
      assignee: ov.assignee !== undefined ? (ov.assignee ? { name: ov.assignee, avatar: "" } : null) : d.assignee,
      completedAt: ov.completedAt !== undefined ? ov.completedAt : d.completedAt,
      manualStatusOverride: ov.manualStatusOverride || d.manualStatusOverride,
      closure: ov.closure ? { ...(d.closure || { category: "", expirationReason: "", supportLevel: "", internalComment: "", autoFilled: { category: false, expirationReason: false, supportLevel: false } }), ...ov.closure } as ClosureFields : d.closure,
    };
  });
}

// Auto-verify and reclassify demands
function autoClassifyDemands(demands: SlackDemand[]): SlackDemand[] {
  return demands.map((d) => {
    // Rule: Remessa SITEF → Hugo Cordeiro Junior, P3
    const titleLower = d.title.toLowerCase();
    if (d.workflow.toLowerCase().includes("remessa") || titleLower.includes("remessa sitef") || titleLower.includes("remessa tef")) {
      return { ...d, assignee: { name: "Hugo Cordeiro Junior", avatar: "" }, priority: "p3" as const };
    }
    // Rule: Conciliação → Daniel Bichof, P3
    if (titleLower.includes("concilia") || titleLower.includes("nova concilia")) {
      return { ...d, assignee: { name: "Daniel Bichof", avatar: "" }, priority: "p3" as const };
    }

    // Skip demands without classification - don't touch them
    if (d.priority === "sem_classificacao") return d;

    const classification = classifyDemand(d.title, d.description);
    const result = { ...d, autoClassification: classification };

    // If classifier disagrees with original priority, reclassify
    if (classification.priority !== "sem_classificacao" && classification.priority !== d.priority) {
      result.autoClassification = {
        ...classification,
        reason: `Reclassificado de ${PRIORITY_CONFIG[d.priority].label} para ${PRIORITY_CONFIG[classification.priority].label}. ${classification.reason}`,
      };
      result.priority = classification.priority;
    } else {
      // Classifier agrees - just add confirmation
      result.autoClassification = {
        ...classification,
        priority: d.priority,
        reason: `Classificacao original confirmada como ${PRIORITY_CONFIG[d.priority].label}. ${classification.reason}`,
      };
    }

    return result;
  });
}

const Demandas = () => {
  const [demands, setDemands] = useState<SlackDemand[]>(() => {
    const classified = autoClassifyDemands(baseDemands);
    const analyzed = processDemandsStatus(classified);
    // Auto-fill closure fields
    const withClosure = analyzed.map((d) => ({
      ...d,
      closure: d.closure || classifyClosureFields(d),
    }));
    return applyOverrides(withClosure);
  });
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
            if (!d.completedAt) return false;
            const daysAgo = differenceInHours(now, new Date(d.completedAt)) / 24;
            if (daysAgo > 7) return false;
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Demandas Slack</h1>
            <p className="text-muted-foreground text-sm mt-1">Acompanhe as demandas recebidas via Slack</p>
          </div>
          <SyncStatusIndicator />
        </div>

        {/* Stats - clicaveis */}
        <DemandStats
          demands={demands}
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
            <DemandKanban demands={filtered} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="date">
            <DemandByDate demands={filtered} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="priority">
            <DemandByPriority demands={filtered} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="assignee">
            <DemandByAssignee demands={filtered} onSelect={setSelected} />
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
