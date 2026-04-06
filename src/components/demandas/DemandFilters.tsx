import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, CalendarDays } from "lucide-react";
import { DemandPriority, DemandStatus } from "@/types/demand";

export interface DemandFilterState {
  search: string;
  priority: DemandPriority | "all";
  status: DemandStatus | "all";
  assignee: string;
  client: string;
  dateFrom: string;
  dateTo: string;
  statFilter: string;
}

export const EMPTY_FILTERS: DemandFilterState = {
  search: "",
  priority: "all",
  status: "all",
  assignee: "",
  client: "",
  dateFrom: "",
  dateTo: "",
  statFilter: "",
};

interface DemandFiltersProps {
  filters: DemandFilterState;
  onChange: (filters: DemandFilterState) => void;
  assignees: string[];
  clients: string[];
}

const DemandFilters = ({ filters, onChange, assignees, clients }: DemandFiltersProps) => {
  const update = (partial: Partial<DemandFilterState>) =>
    onChange({ ...filters, ...partial });

  const hasFilters =
    filters.search ||
    filters.priority !== "all" ||
    filters.status !== "all" ||
    filters.assignee ||
    filters.client ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.statFilter;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar demandas..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        {/* Client */}
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={filters.client}
          onChange={(e) => update({ client: e.target.value })}
        >
          <option value="">Cliente</option>
          {clients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

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
            onClick={() => onChange({ ...EMPTY_FILTERS })}
          >
            <X size={16} className="mr-1" />
            <span className="text-xs">Limpar</span>
          </Button>
        )}
      </div>

      {/* Date range row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <CalendarDays size={14} className="text-muted-foreground shrink-0 hidden sm:block" />
        <span className="text-xs text-muted-foreground shrink-0">Periodo:</span>
        <Input
          type="date"
          className="h-9 w-auto text-sm"
          value={filters.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
        />
        <span className="text-xs text-muted-foreground">ate</span>
        <Input
          type="date"
          className="h-9 w-auto text-sm"
          value={filters.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
        />
      </div>

      {/* Active stat filter indicator */}
      {filters.statFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtro ativo:</span>
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {filters.statFilter}
          </span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => update({ statFilter: "" })}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DemandFilters;
