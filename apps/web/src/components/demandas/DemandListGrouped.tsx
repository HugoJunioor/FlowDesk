import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { SlackDemand, PRIORITY_CONFIG, DemandPriority } from "@/types/demand";
import { extractClientName } from "@/data/mockDemands";
import DemandList from "./DemandList";
import { useLanguage } from "@/contexts/LanguageContext";
import { addBusinessHours, getBusinessMinutesBetween } from "@/lib/businessHours";

interface DemandListGroupedProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
  groupBy: "date" | "priority" | "assignee";
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// `t` eh injetada pelos consumers porque hooks nao podem rodar fora do componente.
// Labels de data (Hoje/Ontem) e de "sem responsavel" reagem ao idioma.

type T = (key: string, params?: Record<string, string | number>) => string;

function groupByDate(demands: SlackDemand[], t: T): { label: string; items: SlackDemand[] }[] {
  const map: Record<string, SlackDemand[]> = {};
  for (const d of demands) {
    const key = format(new Date(d.createdAt), "yyyy-MM-dd");
    if (!map[key]) map[key] = [];
    map[key].push(d);
  }
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const date = new Date(key);
      let label = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
      if (isToday(date)) label = t("common.today");
      else if (isYesterday(date)) label = t("common.yesterday");
      return { label, items: map[key] };
    });
}

/**
 * Minutos uteis ate o prazo. Negativo = estourado.
 * Null pra demandas sem prazo (concluida/expirada/sem_classificacao).
 */
function minutesToDue(d: SlackDemand, now: Date): number | null {
  if (d.status === "concluida" || d.status === "expirada") return null;
  if (d.priority === "sem_classificacao") return null;
  const cfg = PRIORITY_CONFIG[d.priority];
  if (!cfg?.sla) return null;
  const dueDate = d.dueDate
    ? new Date(d.dueDate)
    : addBusinessHours(new Date(d.createdAt), cfg.sla.resolutionHours);
  return getBusinessMinutesBetween(now, dueDate);
}

/**
 * Ordena demandas pelo tempo de atuacao restante (cima = mais urgente):
 *  1. Estouradas primeiro (mais estouradas → topo)
 *  2. Depois por menos tempo restante → mais tempo
 *  3. Sem prazo (concluida/expirada/sem_classificacao) por ultimo
 */
function sortByTimeToAct(demands: SlackDemand[]): SlackDemand[] {
  const now = new Date();
  return [...demands].sort((a, b) => {
    const am = minutesToDue(a, now);
    const bm = minutesToDue(b, now);
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return am - bm;
  });
}

function groupByPriority(demands: SlackDemand[]): { label: string; items: SlackDemand[]; color: string; bg: string }[] {
  const order: DemandPriority[] = ["p1", "p2", "p3", "sem_classificacao"];
  return order
    .map((p) => {
      const cfg = PRIORITY_CONFIG[p];
      return {
        label: cfg.label,
        color: cfg.color,
        bg: cfg.bg,
        // Sempre ordena pelo tempo de atuacao: estouradas no topo, depois
        // menor tempo restante → maior tempo. Independente do toggle slaSort
        // global — dentro do grupo de prioridade essa eh a ordem util.
        items: sortByTimeToAct(demands.filter((d) => d.priority === p)),
      };
    })
    .filter((g) => g.items.length > 0);
}

function groupByAssignee(demands: SlackDemand[], t: T): { label: string; items: SlackDemand[] }[] {
  const noAssigneeLabel = t("demand.label.no_assignee_select");
  const map: Record<string, SlackDemand[]> = {};
  for (const d of demands) {
    const key = d.assignee?.name || noAssigneeLabel;
    if (!map[key]) map[key] = [];
    map[key].push(d);
  }
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((label) => ({ label, items: map[label] }));
}

// ── Component ─────────────────────────────────────────────────────────────────

const DemandListGrouped = ({ demands, onSelect, groupBy }: DemandListGroupedProps) => {
  const { t } = useLanguage();
  const groups =
    groupBy === "date"
      ? groupByDate(demands, t)
      : groupBy === "priority"
      ? groupByPriority(demands)
      : groupByAssignee(demands, t);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Nenhuma demanda encontrada
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const g = group as { label: string; items: SlackDemand[]; color?: string; bg?: string };
        return (
          <div key={g.label}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border">
              <span className={`text-xs font-semibold capitalize ${g.color ?? "text-foreground"}`}>
                {g.label}
              </span>
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 ${g.bg ?? "bg-muted"} ${g.color ?? ""}`}
              >
                {g.items.length}
              </Badge>
            </div>

            {/* Lista rows */}
            <DemandList demands={g.items} onSelect={onSelect} />
          </div>
        );
      })}
    </div>
  );
};

export default DemandListGrouped;
