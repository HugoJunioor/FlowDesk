import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle2, Inbox, ShieldAlert, Zap, MessageCircleOff } from "lucide-react";
import { SlackDemand, PRIORITY_CONFIG } from "@/types/demand";
import { differenceInHours } from "date-fns";
import { addBusinessHours, getFirstResponseMinutes, isExcludedFromFirstResponseSla } from "@/lib/businessHours";

function parseResponseSla(sla: string): number {
  const match = sla.match(/(\d+)\s*(min|hora|horas)/i);
  if (!match) return 60;
  const val = parseInt(match[1]);
  return match[2].startsWith("hora") ? val * 60 : val;
}

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
  const concluidas = demands.filter((d) => d.status === "concluida").length;

  // SLA Estourado: usa slaResolutionStatus da planilha quando disponivel (historico),
  // senao calcula em runtime (demandas atuais)
  const slaBreach = demands.filter((d) => {
    if (d.priority === "sem_classificacao") return false;
    const config = PRIORITY_CONFIG[d.priority];
    if (!config.sla) return false;
    // Dados historicos: usar veredicto da planilha diretamente (verificação estrita)
    if (d.slaResolutionStatus === "expirado") return true;
    if (d.slaResolutionStatus === "atendido") return false;
    // Demandas atuais: calcular em runtime
    if (d.status === "concluida" && d.completedAt) {
      const due = addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours);
      return new Date(d.completedAt) > due;
    }
    // Ainda aberta mas ja passou do prazo
    if (d.status !== "concluida" && d.status !== "expirada") {
      const due = addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours);
      return new Date() > due;
    }
    return d.status === "expirada";
  }).length;

  // SLA 1a resposta estourado
  const firstResponseBreach = demands.filter((d) => {
    if (d.priority === "sem_classificacao") return false;
    if (isExcludedFromFirstResponseSla(d)) return false;
    const config = PRIORITY_CONFIG[d.priority];
    if (!config.sla) return false;
    const mins = getFirstResponseMinutes(d.createdAt, d.threadReplies, d.slaFirstResponse);
    if (mins === null) {
      // Sem resposta ainda - verificar se ja passou do prazo de resposta
      const slaMinutes = parseResponseSla(config.sla.response);
      const elapsed = (new Date().getTime() - new Date(d.createdAt).getTime()) / 60000;
      return elapsed > slaMinutes && d.status !== "concluida";
    }
    const slaMinutes = parseResponseSla(config.sla.response);
    return mins > slaMinutes;
  }).length;

  // Sem interacao 24h: demandas abertas sem nenhuma atividade nas ultimas 24h
  const semInteracao = demands.filter((d) => {
    if (d.status === "concluida" || d.status === "expirada") return false;
    const lastTs = d.threadReplies.length > 0
      ? Math.max(...d.threadReplies.map(r => new Date(r.timestamp).getTime()))
      : new Date(d.createdAt).getTime();
    const hoursSinceLast = (now.getTime() - lastTs) / 3600000;
    return hoursSinceLast > 24;
  }).length;

  const stats = [
    { key: "abertas", title: "Abertas", value: open, icon: Inbox, color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/30" },
    { key: "urgentes", title: "P1 Criticos", value: urgent, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" },
    { key: "vencendo", title: "Vencendo Hoje", value: dueSoon, icon: Clock, color: "text-warning", bg: "bg-warning/10", ring: "ring-warning/30" },
    { key: "concluidas", title: "Concluídas", value: concluidas, icon: CheckCircle2, color: "text-success", bg: "bg-success/10", ring: "ring-success/30" },
    { key: "sla_estourado", title: "SLA Estourado", value: slaBreach, icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" },
    { key: "resposta_atrasada", title: "1a Resp. Atrasada", value: firstResponseBreach, icon: Zap, color: "text-warning", bg: "bg-warning/10", ring: "ring-warning/30" },
    {
      key: "sem_interacao",
      title: "Sem Interação 24h",
      value: semInteracao,
      icon: MessageCircleOff,
      color: semInteracao > 0 ? "text-destructive" : "text-muted-foreground",
      bg: semInteracao > 0 ? "bg-destructive/10" : "bg-muted",
      ring: semInteracao > 0 ? "ring-destructive/30" : "ring-muted-foreground/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
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
