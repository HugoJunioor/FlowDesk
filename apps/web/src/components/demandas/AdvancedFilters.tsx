import { useState } from "react";
import { SlidersHorizontal, X, CalendarDays } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

import {
  DemandFilterState,
  EMPTY_FILTERS,
} from "@/components/demandas/DemandFilters";
import { DemandPriority, DemandStatus } from "@/types/demand";

interface AdvancedFiltersProps {
  filters: DemandFilterState;
  onChange: (filters: DemandFilterState) => void;
  assignees: string[];
  clients: string[];
}

function countActiveFilters(filters: DemandFilterState): number {
  let count = 0;
  if (filters.client) count++;
  if (filters.priority !== "all") count++;
  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.assignee) count++;
  if (filters.status !== "all") count++;
  return count;
}

const AdvancedFilters = ({
  filters,
  onChange,
  assignees,
  clients,
}: AdvancedFiltersProps) => {
  const [open, setOpen] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Scratch state inside the sheet — applied on "Aplicar"
  const [draft, setDraft] = useState<DemandFilterState>(filters);

  const updateDraft = (partial: Partial<DemandFilterState>) =>
    setDraft((prev) => ({ ...prev, ...partial }));

  const handleOpen = (v: boolean) => {
    if (v) setDraft(filters); // sync draft with current filters on open
    setOpen(v);
  };

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleClear = () => {
    const cleared: DemandFilterState = {
      ...filters,
      client: EMPTY_FILTERS.client,
      priority: EMPTY_FILTERS.priority,
      status: EMPTY_FILTERS.status,
      assignee: EMPTY_FILTERS.assignee,
      dateFrom: EMPTY_FILTERS.dateFrom,
      dateTo: EMPTY_FILTERS.dateTo,
      periodPreset: EMPTY_FILTERS.periodPreset,
    };
    setDraft(cleared);
    onChange(cleared);
    setOpen(false);
  };

  const formatDate = (iso: string) =>
    iso ? format(new Date(iso), "dd/MM/yyyy", { locale: ptBR }) : "";

  const activeCount = countActiveFilters(filters);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 text-xs shrink-0"
        onClick={() => handleOpen(true)}
      >
        <SlidersHorizontal size={14} />
        Filtros
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] leading-4">
            {activeCount}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal size={16} />
              Filtros avancados
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-5 py-6">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cliente (canal Slack)</Label>
              <Select
                value={draft.client || "_all_"}
                onValueChange={(v) => updateDraft({ client: v === "_all_" ? "" : v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todos os clientes</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prioridade</Label>
              <Select
                value={draft.priority}
                onValueChange={(v) => updateDraft({ priority: v as DemandPriority | "all" })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todas as prioridades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as prioridades</SelectItem>
                  <SelectItem value="p1">P1 - Critico</SelectItem>
                  <SelectItem value="p2">P2 - Alta</SelectItem>
                  <SelectItem value="p3">P3 - Media</SelectItem>
                  <SelectItem value="sem_classificacao">Sem classificacao</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Periodo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Periodo</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">De:</span>
                  <Popover open={fromOpen} onOpenChange={setFromOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 justify-start text-xs font-normal"
                      >
                        <CalendarDays size={14} className="mr-2 text-muted-foreground" />
                        {draft.dateFrom ? formatDate(draft.dateFrom) : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={draft.dateFrom ? new Date(draft.dateFrom) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          updateDraft({ dateFrom: startOfDay(date).toISOString(), periodPreset: "personalizado" });
                          setFromOpen(false);
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {draft.dateFrom && (
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => updateDraft({ dateFrom: "" })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">Ate:</span>
                  <Popover open={toOpen} onOpenChange={setToOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 justify-start text-xs font-normal"
                      >
                        <CalendarDays size={14} className="mr-2 text-muted-foreground" />
                        {draft.dateTo ? formatDate(draft.dateTo) : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={draft.dateTo ? new Date(draft.dateTo) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          updateDraft({ dateTo: endOfDay(date).toISOString(), periodPreset: "personalizado" });
                          setToOpen(false);
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {draft.dateTo && (
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => updateDraft({ dateTo: "" })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Responsavel */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Responsavel</Label>
              <Select
                value={draft.assignee || "_all_"}
                onValueChange={(v) => updateDraft({ assignee: v === "_all_" ? "" : v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos os responsaveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todos os responsaveis</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) => updateDraft({ status: v as DemandStatus | "all" })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluida</SelectItem>
                  <SelectItem value="expirada">Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={handleClear}
            >
              <X size={14} className="mr-1" />
              Limpar tudo
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={handleApply}>
              Aplicar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdvancedFilters;
