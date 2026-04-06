import { useState, useMemo, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Calendar, Signal, Users } from "lucide-react";
import { differenceInHours } from "date-fns";
import { mockDemands, extractClientName } from "@/data/mockDemands";
import { SlackDemand } from "@/types/demand";
import DemandStats from "@/components/demandas/DemandStats";
import DemandFilters, { DemandFilterState, EMPTY_FILTERS } from "@/components/demandas/DemandFilters";
import DemandKanban from "@/components/demandas/DemandKanban";
import DemandByDate from "@/components/demandas/DemandByDate";
import DemandByPriority from "@/components/demandas/DemandByPriority";
import DemandByAssignee from "@/components/demandas/DemandByAssignee";
import DemandDetailSheet from "@/components/demandas/DemandDetailSheet";
import SyncStatusIndicator from "@/components/demandas/SyncStatusIndicator";

const TEAM_MEMBERS = [
  "Maria S.",
  "Joao P.",
  "Ana L.",
  "Carlos R.",
];

const Demandas = () => {
  const [demands, setDemands] = useState<SlackDemand[]>(mockDemands);
  const [filters, setFilters] = useState<DemandFilterState>({ ...EMPTY_FILTERS });
  const [selected, setSelected] = useState<SlackDemand | null>(null);

  const assignees = useMemo(() => {
    const set = new Set<string>(TEAM_MEMBERS);
    demands.forEach((d) => {
      if (d.assignee) set.add(d.assignee.name);
    });
    return Array.from(set).sort();
  }, [demands]);

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
          <TabsList className="mb-4">
            <TabsTrigger value="kanban" className="gap-1.5 text-xs">
              <LayoutGrid size={14} /> Visao Geral
            </TabsTrigger>
            <TabsTrigger value="date" className="gap-1.5 text-xs">
              <Calendar size={14} /> Por Data
            </TabsTrigger>
            <TabsTrigger value="priority" className="gap-1.5 text-xs">
              <Signal size={14} /> Por Prioridade
            </TabsTrigger>
            <TabsTrigger value="assignee" className="gap-1.5 text-xs">
              <Users size={14} /> Por Responsavel
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
        />
      </div>
    </AppLayout>
  );
};

export default Demandas;
