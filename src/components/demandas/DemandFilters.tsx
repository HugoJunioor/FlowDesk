import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, CalendarDays } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DemandPriority, DemandStatus } from "@/types/demand";

export type PeriodPreset = "hoje" | "semanal" | "mensal" | "personalizado" | "";

export interface DemandFilterState {
  search: string;
  priority: DemandPriority | "all";
  status: DemandStatus | "all";
  assignee: string;
  client: string;
  dateFrom: string;
  dateTo: string;
  statFilter: string;
  periodPreset: PeriodPreset;
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
  periodPreset: "",
};

interface DemandFiltersProps {
  filters: DemandFilterState;
  onChange: (filters: DemandFilterState) => void;
  assignees: string[];
  clients: string[];
}

function getPeriodDates(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case "hoje":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "semanal":
      return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: endOfWeek(now, { weekStartsOn: 1 }).toISOString() };
    case "mensal":
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    default:
      return { from: "", to: "" };
  }
}

const DemandFilters = ({ filters, onChange, assignees, clients }: DemandFiltersProps) => {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const update = (partial: Partial<DemandFilterState>) =>
    onChange({ ...filters, ...partial });

  const handlePeriodClick = (preset: PeriodPreset) => {
    if (filters.periodPreset === preset) {
      // Toggle off
      update({ periodPreset: "", dateFrom: "", dateTo: "" });
    } else if (preset === "personalizado") {
      update({ periodPreset: "personalizado" });
    } else {
      const dates = getPeriodDates(preset);
      update({ periodPreset: preset, dateFrom: dates.from, dateTo: dates.to });
    }
  };

  const handleDateFromSelect = (date: Date | undefined) => {
    if (!date) return;
    update({ dateFrom: startOfDay(date).toISOString(), periodPreset: "personalizado" });
    setFromOpen(false);
  };

  const handleDateToSelect = (date: Date | undefined) => {
    if (!date) return;
    update({ dateTo: endOfDay(date).toISOString(), periodPreset: "personalizado" });
    setToOpen(false);
  };

  const hasFilters =
    filters.search ||
    filters.priority !== "all" ||
    filters.status !== "all" ||
    filters.assignee ||
    filters.client ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.statFilter ||
    filters.periodPreset;

  const formatDateDisplay = (iso: string) => {
    if (!iso) return "";
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-3">
      {/* Period quick filters */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "hoje" as PeriodPreset, label: "Hoje" },
          { key: "semanal" as PeriodPreset, label: "Semanal" },
          { key: "mensal" as PeriodPreset, label: "Mensal" },
          { key: "personalizado" as PeriodPreset, label: "Personalizado" },
        ]).map((p) => (
          <Button
            key={p.key}
            variant={filters.periodPreset === p.key ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => handlePeriodClick(p.key)}
          >
            {p.key === "personalizado" && <CalendarDays size={13} className="mr-1" />}
            {p.label}
          </Button>
        ))}
      </div>

      {/* Custom date pickers - shown when personalizado is active */}
      {filters.periodPreset === "personalizado" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">De:</span>
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 min-w-[140px] justify-start text-xs font-normal">
                <CalendarDays size={14} className="mr-2 text-muted-foreground" />
                {filters.dateFrom ? formatDateDisplay(filters.dateFrom) : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                onSelect={handleDateFromSelect}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground shrink-0">Ate:</span>
          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 min-w-[140px] justify-start text-xs font-normal">
                <CalendarDays size={14} className="mr-2 text-muted-foreground" />
                {filters.dateTo ? formatDateDisplay(filters.dateTo) : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                onSelect={handleDateToSelect}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Main filters row */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar demandas..."
            className="pl-9 h-9"
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
          <option value="sem_classificacao">Sem classificacao</option>
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
