import { Badge } from "@/components/ui/badge";
import { SlackDemand, DemandPriority, PRIORITY_CONFIG } from "@/types/demand";
import DemandCard from "./DemandCard";

interface DemandByPriorityProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
}

const priorities: DemandPriority[] = ["p1", "p2", "p3", "sem_classificacao"];

const DemandByPriority = ({ demands, onSelect }: DemandByPriorityProps) => {
  return (
    <div className="space-y-8">
      {priorities.map((p) => {
        const items = demands.filter((d) => d.priority === p);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
