import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { DemandPriority, DemandStatus } from "@/types/demand";

export interface DemandFilterState {
  search: string;
  priority: DemandPriority | "all";
  status: DemandStatus | "all";
  assignee: string;
}

interface DemandFiltersProps {
  filters: DemandFilterState;
  onChange: (filters: DemandFilterState) => void;
  assignees: string[];
}

const DemandFilters = ({ filters, onChange, assignees }: DemandFiltersProps) => {
  const update = (partial: Partial<DemandFilterState>) =>
    onChange({ ...filters, ...partial });

  const hasFilters =
    filters.search || filters.priority !== "all" || filters.status !== "all" || filters.assignee;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar demandas..."
          className="pl-9"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
        />
      </div>

      {/* Priority */}
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        value={filters.priority}
        onChange={(e) => update({ priority: e.target.value as DemandPriority | "all" })}
      >
        <option value="all">Prioridade</option>
        <option value="p1">P1 - Critico</option>
        <option value="p2">P2 - Alta</option>
        <option value="p3">P3 - Media</option>
      </select>

      {/* Status */}
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as DemandStatus | "all" })}
      >
        <option value="all">Status</option>
        <option value="aberta">Aberta</option>
        <option value="em_andamento">Em andamento</option>
        <option value="concluida">Concluida</option>
        <option value="expirada">Expirada</option>
      </select>

      {/* Assignee */}
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        value={filters.assignee}
        onChange={(e) => update({ assignee: e.target.value })}
      >
        <option value="">Responsavel</option>
        {assignees.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-muted-foreground"
          onClick={() => onChange({ search: "", priority: "all", status: "all", assignee: "" })}
        >
          <X size={16} />
        </Button>
      )}
    </div>
  );
};

export default DemandFilters;
