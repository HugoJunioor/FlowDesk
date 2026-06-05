import { Badge } from "@/components/ui/badge";
import { SlackDemand, DemandPriority, PRIORITY_CONFIG } from "@/types/demand";
import DemandCard from "./DemandCard";
import { addBusinessHours, getBusinessMinutesBetween } from "@/lib/businessHours";

interface DemandByPriorityProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
}

const priorities: DemandPriority[] = ["p1", "p2", "p3", "sem_classificacao"];

/** Minutos uteis ate o prazo. Negativo = estourado. Null se sem prazo. */
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

/** Ordena: estouradas no topo, depois menor tempo restante, sem-prazo no fim. */
function sortByTimeToAct(arr: SlackDemand[]): SlackDemand[] {
  const now = new Date();
  return [...arr].sort((a, b) => {
    const am = minutesToDue(a, now);
    const bm = minutesToDue(b, now);
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return am - bm;
  });
}

const DemandByPriority = ({ demands, onSelect }: DemandByPriorityProps) => {
  return (
    <div className="space-y-8">
      {priorities.map((p) => {
        // Dentro de cada quadro de prioridade, ordena pelo tempo de atuacao:
        // estouradas primeiro (mais urgente no topo), depois por menos tempo
        // restante. Sem-prazo no fim.
        const items = sortByTimeToAct(demands.filter((d) => d.priority === p));
        const config = PRIORITY_CONFIG[p];
        if (items.length === 0) return null;

        return (
          <div key={p}>
            {/* Priority header */}
            <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${config.border.replace("border-l-", "border-b-")}`}>
              <h3 className={`text-sm font-semibold ${config.color}`}>{config.label}</h3>
              <Badge variant="secondary" className={`text-[10px] ${config.bg} ${config.color}`}>
                {items.length}
              </Badge>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {items.map((demand) => (
                <DemandCard key={demand.id} demand={demand} onClick={() => onSelect(demand)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DemandByPriority;
