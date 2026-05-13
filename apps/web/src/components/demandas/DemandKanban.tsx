import { Badge } from "@/components/ui/badge";
import { SlackDemand, DemandStatus, STATUS_CONFIG } from "@/types/demand";
import DemandCard from "./DemandCard";

interface DemandKanbanProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
}

const columns: DemandStatus[] = ["aberta", "em_andamento", "concluida", "expirada"];

const DemandKanban = ({ demands, onSelect }: DemandKanbanProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {columns.map((col) => {
        const items = demands.filter((d) => d.status === col);
        const config = STATUS_CONFIG[col];
        return (
          <div key={col} className="space-y-3 min-w-0">
            {/* Column header */}
            <div className="flex items-center justify-between px-1 sticky top-0 bg-background z-10 py-1">
              <h3 className={`text-sm font-semibold ${config.color}`}>{config.label}</h3>
              <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
            </div>

            {/* Cards */}
            <div className="space-y-3 xl:max-h-[calc(100vh-260px)] xl:overflow-y-auto xl:pr-1">
              {items.map((demand) => (
                <DemandCard key={demand.id} demand={demand} onClick={() => onSelect(demand)} />
              ))}
              {items.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Nenhuma demanda
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DemandKanban;
