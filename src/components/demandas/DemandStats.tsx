import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle2, Inbox } from "lucide-react";
import { SlackDemand } from "@/types/demand";
import { differenceInHours } from "date-fns";

interface DemandStatsProps {
  demands: SlackDemand[];
  activeFilter: string;
  onFilterClick: (filter: string) => void;
}

const DemandStats = ({ demands, activeFilter, onFilterClick }: DemandStatsProps) => {
  const now = new Date();

  const open = demands.filter((d) => d.status === "aberta" || d.status === "em_andamento").length;
  const urgent = demands.filter((d) => d.priority === "p1" && d.status !== "concluida").length;
  const dueSoon = demands.filter((d) => {
    if (d.status === "concluida" || d.status === "expirada") return false;
    const hoursLeft = differenceInHours(new Date(d.dueDate), now);
    return hoursLeft >= 0 && hoursLeft <= 24;
  }).length;
  const completedWeek = demands.filter((d) => {
    if (!d.completedAt) return false;
    const daysAgo = differenceInHours(now, new Date(d.completedAt)) / 24;
    return daysAgo <= 7;
  }).length;

  const stats = [
    { key: "abertas", title: "Abertas", value: open, icon: Inbox, color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/30" },
    { key: "urgentes", title: "P1 Criticos", value: urgent, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" },
    { key: "vencendo", title: "Vencendo Hoje", value: dueSoon, icon: Clock, color: "text-warning", bg: "bg-warning/10", ring: "ring-warning/30" },
    { key: "concluidas", title: "Concluidas (7d)", value: completedWeek, icon: CheckCircle2, color: "text-success", bg: "bg-success/10", ring: "ring-success/30" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const isActive = activeFilter === stat.key;
        return (
          <Card
            key={stat.key}
            className={`border border-border shadow-sm cursor-pointer transition-all hover:shadow-md ${
              isActive ? `ring-2 ${stat.ring} shadow-md` : ""
            }`}
            onClick={() => onFilterClick(isActive ? "" : stat.key)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DemandStats;
