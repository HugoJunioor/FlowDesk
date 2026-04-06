import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { SlackDemand } from "@/types/demand";
import DemandCard from "./DemandCard";

interface DemandByDateProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
}

const DemandByDate = ({ demands, onSelect }: DemandByDateProps) => {
  // Group by creation date
  const grouped = demands.reduce<Record<string, SlackDemand[]>>((acc, d) => {
    const key = format(new Date(d.createdAt), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        const items = grouped[date];
        const dateObj = new Date(date);
        return (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background py-1 z-10">
              <h3 className={`text-sm font-semibold capitalize ${isToday(dateObj) ? "text-primary" : "text-foreground"}`}>
                {formatDateLabel(date)}
              </h3>
              <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
              {isToday(dateObj) && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
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

export default DemandByDate;
