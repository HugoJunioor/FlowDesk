import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Calendar, Signal, Users } from "lucide-react";
import { mockDemands } from "@/data/mockDemands";
import { SlackDemand } from "@/types/demand";
import DemandStats from "@/components/demandas/DemandStats";
import DemandFilters, { DemandFilterState } from "@/components/demandas/DemandFilters";
import DemandKanban from "@/components/demandas/DemandKanban";
import DemandByDate from "@/components/demandas/DemandByDate";
import DemandByPriority from "@/components/demandas/DemandByPriority";
import DemandByAssignee from "@/components/demandas/DemandByAssignee";
import DemandDetailSheet from "@/components/demandas/DemandDetailSheet";
import SyncStatusIndicator from "@/components/demandas/SyncStatusIndicator";

const Demandas = () => {
  const [filters, setFilters] = useState<DemandFilterState>({
    search: "",
    priority: "all",
    status: "all",
    assignee: "",
  });
  const [selected, setSelected] = useState<SlackDemand | null>(null);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    mockDemands.forEach((d) => {
      if (d.assignee) set.add(d.assignee.name);
    });
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    return mockDemands.filter((d) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          d.title.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.tags.some((t) => t.includes(q)) ||
          d.assignee?.name.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.priority !== "all" && d.priority !== filters.priority) return false;
      if (filters.status !== "all" && d.status !== filters.status) return false;
      if (filters.assignee && d.assignee?.name !== filters.assignee) return false;
      return true;
    });
  }, [filters]);

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

        {/* Stats */}
        <DemandStats demands={mockDemands} />

        {/* Filters */}
        <DemandFilters filters={filters} onChange={setFilters} assignees={assignees} />

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
        />
      </div>
    </AppLayout>
  );
};

export default Demandas;
