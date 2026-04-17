import { SlackDemand, STATUS_CONFIG } from "@/types/demand";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import CopyLinkButton from "@/components/demandas/CopyLinkButton";
import { formatHandlingTime, getHandlingMinutes, getApprovedAt } from "@/lib/sqlSla";

interface SqlDemandListProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
  onApprove: (demandId: string) => void;
}

/**
 * Lista especifica do modulo SQL.
 * Tem coluna SLA (tempo de atendimento) e botao "Aprovar" para demandas abertas.
 */
const SqlDemandList = ({ demands, onSelect, onApprove }: SqlDemandListProps) => {
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
        <span className="w-[100px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Responsável</span>
        <span className="w-[90px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status</span>
        <span className="w-[80px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Criado</span>
        <span className="w-[90px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">SLA</span>
        <span className="w-[110px] shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground font-medium text-right">Ações</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/60 max-h-[70vh] overflow-y-auto">
        {demands.map((d) => {
          const statusCfg = STATUS_CONFIG[d.status];
          const handlingMin = getHandlingMinutes(d);
          const approvedAt = getApprovedAt(d);

          return (
            <div
              key={d.id}
              className="flex flex-col md:flex-row md:items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => onSelect(d)}
            >
              {/* Título */}
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
              <span className="w-full md:w-[100px] shrink-0 text-xs text-muted-foreground truncate">
                {d.assignee?.name || "—"}
              </span>

              {/* Status */}
              <span
                className={`w-full md:w-[90px] shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color} inline-flex items-center justify-center`}
              >
                {statusCfg.label}
              </span>

              {/* Criado */}
              <span className="w-full md:w-[80px] shrink-0 text-xs text-muted-foreground">
                {format(new Date(d.createdAt), "dd/MM HH:mm", { locale: ptBR })}
              </span>

              {/* SLA - tempo de atendimento */}
              <span
                className="w-full md:w-[90px] shrink-0 text-xs font-medium"
                title={approvedAt ? `Aprovada em ${format(new Date(approvedAt), "dd/MM HH:mm", { locale: ptBR })}` : "Aguardando aprovação"}
              >
                {d.status === "aberta" ? (
                  <span className="text-muted-foreground italic">—</span>
                ) : d.status === "concluida" ? (
                  <span className="text-success">{formatHandlingTime(handlingMin)}</span>
                ) : (
                  <span className="text-warning">{formatHandlingTime(handlingMin)}</span>
                )}
              </span>

              {/* Ações */}
              <div className="w-full md:w-[110px] shrink-0 flex justify-end">
                {d.status === "aberta" && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onApprove(d.id);
                    }}
                    title="Aprovar a demanda (inicia contagem de SLA)"
                  >
                    <Check size={12} />
                    Aprovar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SqlDemandList;
