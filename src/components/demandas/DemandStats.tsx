import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle2, Inbox } from "lucide-react";
import { SlackDemand } from "@/types/demand";
import { differenceInHours } from "date-fns";

interface DemandStatsProps {
  demands: SlackDemand[];
}

const DemandStats = ({ demands }: DemandStatsProps) => {
  const now = new Date();

  const open = demands.filter((d) => d.status === "aberta" || d.status === "em_andamento").length;
  const urgent = demands.filter((d) => d.priority === "urgente" && d.status !== "concluida").length;
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
    { title: "Abertas", value: open, icon: Inbox, color: "text-primary", bg: "bg-primary/10" },
    { title: "Urgentes", value: urgent, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { title: "Vencendo Hoje", value: dueSoon, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { title: "Concluidas (7d)", value: completedWeek, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border border-border shadow-sm">
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
      ))}
    </div>
  );
};

export default DemandStats;
