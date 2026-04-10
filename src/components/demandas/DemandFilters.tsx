import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, CalendarDays } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DemandPriority, DemandStatus, DemandCategory, SupportLevel, CATEGORY_OPTIONS, SUPPORT_LEVEL_OPTIONS } from "@/types/demand";

export type PeriodPreset = "hoje" | "semanal" | "mensal" | "anual" | "personalizado" | "";

export interface DemandFilterState {
  search: string;
  priority: DemandPriority | "all";
  status: DemandStatus | "all";
  assignee: string;
  client: string;
  dateFrom: string;
  dateTo: string;
  category: DemandCategory | "all";
  supportLevel: SupportLevel | "all";
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
  category: "all",
  supportLevel: "all",
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const update = (partial: Partial<DemandFilterState>) =>
    onChange({ ...filters, ...partial });

  const handlePeriodClick = (preset: PeriodPreset) => {
    if (filters.periodPreset === preset) {
      // Toggle off
      update({ periodPreset: "", dateFrom: "", dateTo: "" });
    } else if (preset === "personalizado") {
      update({ periodPreset: "personalizado" });
    } else if (preset === "anual") {
      const year = selectedYear;
      update({
        periodPreset: "anual",
        dateFrom: new Date(year, 0, 1).toISOString(),
        dateTo: new Date(year, 11, 31, 23, 59, 59).toISOString(),
      });
    } else {
      const dates = getPeriodDates(preset);
      update({ periodPreset: preset, dateFrom: dates.from, dateTo: dates.to });
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    update({
      periodPreset: "anual",
      dateFrom: new Date(year, 0, 1).toISOString(),
      dateTo: new Date(year, 11, 31, 23, 59, 59).toISOString(),
    });
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
    filters.category !== "all" ||
    filters.supportLevel !== "all" ||
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
          { key: "anual" as PeriodPreset, label: "Anual" },
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

        {filters.periodPreset === "anual" && (
          <Select value={String(selectedYear)} onValueChange={(v) => handleYearChange(Number(v))}>
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Custom date pickers - shown when personalizado is active */}
      {filters.periodPreset === "personalizado" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">De:</span>
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 min-w-[120px] sm:min-w-[140px] justify-start text-xs font-normal">
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
              <Button variant="outline" size="sm" className="h-9 min-w-[120px] sm:min-w-[140px] justify-start text-xs font-normal">
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
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar demandas..."
            className="pl-9 h-9"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        {/* Client */}
        <Select value={filters.client || "_all_"} onValueChange={(v) => update({ client: v === "_all_" ? "" : v })}>
          <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all_">Cliente</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority */}
        <Select value={filters.priority} onValueChange={(v) => update({ priority: v as DemandPriority | "all" })}>
          <SelectTrigger className="h-9 w-full sm:w-[150px] text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prioridade</SelectItem>
            <SelectItem value="p1">P1 - Critico</SelectItem>
            <SelectItem value="p2">P2 - Alta</SelectItem>
            <SelectItem value="p3">P3 - Media</SelectItem>
            <SelectItem value="sem_classificacao">Sem classificacao</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={filters.status} onValueChange={(v) => update({ status: v as DemandStatus | "all" })}>
          <SelectTrigger className="h-9 w-full sm:w-[150px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluida</SelectItem>
            <SelectItem value="expirada">Expirada</SelectItem>
          </SelectContent>
        </Select>

        {/* Assignee */}
        <Select value={filters.assignee || "_all_"} onValueChange={(v) => update({ assignee: v === "_all_" ? "" : v })}>
          <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs">
            <SelectValue placeholder="Responsavel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all_">Responsável</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select value={filters.category} onValueChange={(v) => update({ category: v as DemandCategory | "all" })}>
          <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Categoria</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Support Level */}
        <Select value={filters.supportLevel} onValueChange={(v) => update({ supportLevel: v as SupportLevel | "all" })}>
          <SelectTrigger className="h-9 w-full sm:w-[120px] text-xs">
            <SelectValue placeholder="Nivel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Nível</SelectItem>
            {SUPPORT_LEVEL_OPTIONS.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
