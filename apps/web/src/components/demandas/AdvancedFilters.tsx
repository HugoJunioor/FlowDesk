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
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
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
        {t("demands.filters.button")}
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
              {t("demands.filters.title")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-5 py-6">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("demands.filters.client_label")}</Label>
              <Select
                value={draft.client || "_all_"}
                onValueChange={(v) => updateDraft({ client: v === "_all_" ? "" : v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("demands.filters.all_clients")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">{t("demands.filters.all_clients")}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("common.priority")}</Label>
              <Select
                value={draft.priority}
                onValueChange={(v) => updateDraft({ priority: v as DemandPriority | "all" })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("demands.filters.all_priorities")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("demands.filters.all_priorities")}</SelectItem>
                  <SelectItem value="p1">{t("priority.p1")}</SelectItem>
                  <SelectItem value="p2">{t("priority.p2")}</SelectItem>
                  <SelectItem value="p3">{t("priority.p3")}</SelectItem>
                  <SelectItem value="sem_classificacao">{t("priority.unclassified")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Periodo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("demands.filters.period_label")}</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{t("dashboard.from_label")}</span>
                  <Popover open={fromOpen} onOpenChange={setFromOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 justify-start text-xs font-normal"
                      >
                        <CalendarDays size={14} className="mr-2 text-muted-foreground" />
                        {draft.dateFrom ? formatDate(draft.dateFrom) : t("common.select")}
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
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{t("dashboard.to_label")}</span>
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
              <Label className="text-xs font-medium">{t("common.assignee")}</Label>
              <Select
                value={draft.assignee || "_all_"}
                onValueChange={(v) => updateDraft({ assignee: v === "_all_" ? "" : v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("demands.filters.all_assignees")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">{t("demands.filters.all_assignees")}</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("common.status")}</Label>
              <Select
                value={draft.status}
                onValueChange={(v) => updateDraft({ status: v as DemandStatus | "all" })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("demands.filters.all_statuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("demands.filters.all_statuses")}</SelectItem>
                  <SelectItem value="aberta">{t("status.open")}</SelectItem>
                  <SelectItem value="em_andamento">{t("status.in_progress")}</SelectItem>
                  <SelectItem value="concluida">{t("status.completed")}</SelectItem>
                  <SelectItem value="expirada">{t("status.expired")}</SelectItem>
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
              {t("demands.filters.clear_all")}
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={handleApply}>
              {t("demands.filters.apply")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdvancedFilters;
