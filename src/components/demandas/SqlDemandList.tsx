import { SlackDemand, STATUS_CONFIG } from "@/types/demand";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Clock } from "lucide-react";
import CopyLinkButton from "@/components/demandas/CopyLinkButton";
import { formatHandlingTime, getHandlingMinutes, getApprovedAt } from "@/lib/sqlSla";

interface SqlDemandListProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
}

/**
 * Lista especifica do modulo SQL com coluna SLA (tempo de atendimento
 * em horario comercial: Seg-Sex 8-18, excluindo feriados).
 */
const SqlDemandList = ({ demands, onSelect }: SqlDemandListProps) => {
  if (demands.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground border rounded-lg">
        Nenhuma demanda encontrada
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border/60">
        <span className="flex-1 min-w-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Título</span>
        <span className="w-[120px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Solicitante</span>
        <span className="w-[110px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Responsável</span>
        <span className="w-[95px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status</span>
        <span className="w-[85px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Criado</span>
        <span className="w-[100px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Concluído</span>
        <span className="w-[115px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">SLA (útil)</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/60 max-h-[70vh] overflow-y-auto">
        {demands.map((d) => {
          const statusCfg = STATUS_CONFIG[d.status];
          const handlingMin = getHandlingMinutes(d);
          const approvedAt = getApprovedAt(d);
          const approvedLabel = approvedAt
            ? format(new Date(approvedAt), "dd/MM HH:mm", { locale: ptBR })
            : null;

          return (
            <div
              key={d.id}
              className="flex flex-col md:flex-row md:items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => onSelect(d)}
            >
              {/* Título + links */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm text-foreground truncate font-medium">{d.title}</span>
                {d.slackPermalink && (
                  <a
                    href={d.slackPermalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary shrink-0"
                    title="Abrir no Slack"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                {d.slackPermalink && <CopyLinkButton url={d.slackPermalink} size={12} />}
              </div>

              {/* Solicitante */}
              <span className="w-full md:w-[120px] shrink-0 text-xs text-muted-foreground truncate">
                {d.requester?.name || "—"}
              </span>

              {/* Responsável */}
              <span className="w-full md:w-[110px] shrink-0 text-xs text-muted-foreground truncate">
                {d.assignee?.name || "—"}
              </span>

              {/* Status */}
              <span
                className={`w-fit md:w-[95px] shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color} inline-flex items-center justify-center`}
              >
                {statusCfg.label}
              </span>

              {/* Criado */}
              <span className="w-full md:w-[85px] shrink-0 text-xs text-muted-foreground">
                {format(new Date(d.createdAt), "dd/MM HH:mm", { locale: ptBR })}
              </span>

              {/* Concluído */}
              <span className="w-full md:w-[100px] shrink-0 text-xs text-muted-foreground">
                {d.status === "concluida" && d.completedAt
                  ? format(new Date(d.completedAt), "dd/MM HH:mm", { locale: ptBR })
                  : "—"}
              </span>

              {/* SLA - tempo de atendimento em horas uteis */}
              <div
                className="w-full md:w-[115px] shrink-0 flex items-center gap-1"
                title={approvedLabel ? `Aprovada em ${approvedLabel}` : "Aguardando aprovação"}
              >
                <Clock
                  size={11}
                  className={
                    d.status === "aberta"
                      ? "text-muted-foreground"
                      : d.status === "concluida"
                      ? "text-success"
                      : "text-warning"
                  }
                />
                <span
                  className={`text-xs font-medium ${
                    d.status === "aberta"
                      ? "text-muted-foreground italic"
                      : d.status === "concluida"
                      ? "text-success"
                      : "text-warning"
                  }`}
                >
                  {d.status === "aberta" ? "aguardando" : formatHandlingTime(handlingMin)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SqlDemandList;
