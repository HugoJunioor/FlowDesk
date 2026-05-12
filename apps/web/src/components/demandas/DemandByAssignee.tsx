import { Badge } from "@/components/ui/badge";
import { SlackDemand } from "@/types/demand";
import DemandCard from "./DemandCard";

interface DemandByAssigneeProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
}

const DemandByAssignee = ({ demands, onSelect }: DemandByAssigneeProps) => {
  // Group by assignee
  const grouped = demands.reduce<Record<string, SlackDemand[]>>((acc, d) => {
    const key = d.assignee?.name || "Sem responsavel";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const sortedAssignees = Object.keys(grouped).sort((a, b) => {
    if (a === "Sem responsavel") return 1;
    if (b === "Sem responsavel") return -1;
    return grouped[b].length - grouped[a].length;
  });

  return (
    <div className="space-y-8">
      {sortedAssignees.map((assignee) => {
        const items = grouped[assignee];
        const openCount = items.filter((d) => d.status === "aberta" || d.status === "em_andamento").length;
        const expiredCount = items.filter((d) => d.status === "expirada").length;
        const initials = assignee === "Sem responsavel"
          ? "?"
          : assignee.split(" ").map((n) => n[0]).join("");

        return (
          <div key={assignee}>
            {/* Assignee header */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-border">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{assignee}</h3>
                <div className="flex items-center gap-1 sm:gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">{items.length} total</span>
                  {openCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-info/10 text-info">
                      {openCount} abertas
                    </Badge>
                  )}
                  {expiredCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-destructive/10 text-destructive">
                      {expiredCount} expiradas
                    </Badge>
                  )}
                </div>
              </div>
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

export default DemandByAssignee;
