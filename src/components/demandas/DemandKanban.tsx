import { ScrollArea } from "@/components/ui/scroll-area";
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
          <div key={col} className="space-y-3">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <h3 className={`text-sm font-semibold ${config.color}`}>{config.label}</h3>
              <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
            </div>

            {/* Cards */}
            <ScrollArea className="h-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-320px)] lg:h-[calc(100vh-340px)] pr-1">
              <div className="space-y-3">
                {items.map((demand) => (
                  <DemandCard key={demand.id} demand={demand} onClick={() => onSelect(demand)} />
                ))}
                {items.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Nenhuma demanda
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};

export default DemandKanban;
