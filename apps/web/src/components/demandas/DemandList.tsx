import { SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG } from "@/types/demand";
import { extractClientName } from "@/data/mockDemands";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, ExternalLink } from "lucide-react";
import ExpirationCountdown from "@/components/demandas/ExpirationCountdown";
import CopyLinkButton from "@/components/demandas/CopyLinkButton";
import StaleBadge from "./StaleBadge";
import { useLanguage } from "@/contexts/LanguageContext";

interface DemandListProps {
  demands: SlackDemand[];
  onSelect: (demand: SlackDemand) => void;
}

const DemandList = ({ demands, onSelect }: DemandListProps) => {
  const { t } = useLanguage();
  // Headers reativos ao idioma — re-computa quando user troca lingua.
  // Larguras redistribuidas pra dar espaco ao titulo (flex-1) e ao responsavel
  // (caia de 80→140), e cortar gordura da coluna de inatividade (so um badge).
  const HEADERS = [
    { label: t("demands.list.col.priority"), width: "w-[40px] flex-shrink-0" },
    { label: t("demands.list.col.title"), width: "flex-1 min-w-[160px]" },
    { label: t("demands.list.col.inactivity"), width: "w-[90px] flex-shrink-0 text-center" },
    { label: t("demands.list.col.client"), width: "w-[110px] flex-shrink-0" },
    { label: t("demands.list.col.type"), width: "w-[100px] flex-shrink-0 hidden lg:block" },
    { label: t("demands.list.col.status"), width: "w-[90px] flex-shrink-0" },
    { label: t("demands.list.col.assignee"), width: "w-[140px] flex-shrink-0" },
    { label: t("demands.list.col.created"), width: "w-[80px] flex-shrink-0 hidden xl:block" },
    { label: t("demands.list.col.sla"), width: "w-[90px] flex-shrink-0" },
  ];

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background sticky top-0 border-b border-border/60 z-10">
        {HEADERS.map((col) => (
          <span
            key={col.label}
            className={`${col.width} text-[10px] uppercase tracking-wide text-muted-foreground font-medium`}
          >
            {col.label}
          </span>
        ))}
      </div>

      {/* Scrollable rows */}
      <div className="max-h-[70vh] overflow-y-auto">
        {demands.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Nenhuma demanda encontrada
          </div>
        ) : (
          demands.map((d) => {
            const priorityCfg = PRIORITY_CONFIG[d.priority];
            const statusCfg = STATUS_CONFIG[d.status];
            const clientName = extractClientName(d.slackChannel);
            const createdDate = d.createdAt
              ? format(new Date(d.createdAt), "dd/MM HH:mm", { locale: ptBR })
              : "—";

            return (
              <div
                key={d.id}
                onClick={() => onSelect(d)}
                className={`flex items-center gap-2 py-2 px-3 hover:bg-muted/40 cursor-pointer border-b border-border/40 border-l-[3px] ${priorityCfg.border}`}
              >
                {/* Priority badge */}
                <div className="w-[40px] flex-shrink-0">
                  <span
                    className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold ${priorityCfg.bg} ${priorityCfg.color}`}
                  >
                    {priorityCfg.shortLabel}
                  </span>
                </div>

                {/* Title + Slack actions */}
                <div className="flex-1 min-w-[160px] flex items-center gap-1 group/title">
                  <span className="truncate text-sm font-medium min-w-0" title={d.title}>
                    {d.title}
                  </span>
                  {d.slackPermalink && (
                    <>
                      <a
                        href={d.slackPermalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("demands.list.open_in_slack")}
                        className="flex-shrink-0 opacity-0 group-hover/title:opacity-40 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} />
                      </a>
                      <div
                        className="flex-shrink-0 opacity-0 group-hover/title:opacity-40 hover:!opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CopyLinkButton url={d.slackPermalink} size={12} />
                      </div>
                    </>
                  )}
                </div>

                {/* Sem interacao > 24h (badge piscante) */}
                <div className="w-[90px] flex-shrink-0 flex justify-center">
                  <StaleBadge demand={d} compact />
                </div>

                {/* Client */}
                <div className="w-[110px] flex-shrink-0 flex items-center gap-1 min-w-0">
                  <Building2 size={11} className="flex-shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs text-muted-foreground" title={clientName}>{clientName}</span>
                </div>

                {/* Type — escondido em telas < lg pra dar fôlego às colunas principais */}
                <div className="w-[100px] flex-shrink-0 hidden lg:block">
                  <span className="truncate text-xs block" title={d.demandType}>{d.demandType}</span>
                </div>

                {/* Status badge */}
                <div className="w-[90px] flex-shrink-0">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {/* Assignee */}
                <div className="w-[140px] flex-shrink-0">
                  <span className="truncate text-xs block" title={d.assignee?.name || t("demands.list.no_assignee")}>
                    {d.assignee?.name || t("demands.list.no_assignee")}
                  </span>
                </div>

                {/* Created date — escondido em telas < xl */}
                <div className="w-[80px] flex-shrink-0 hidden xl:block">
                  <span className="text-xs text-muted-foreground">{createdDate}</span>
                </div>

                {/* SLA indicator */}
                <div className="w-[90px] flex-shrink-0">
                  {d.dueDate || d.priority !== "sem_classificacao" ? (
                    <ExpirationCountdown
                      dueDate={d.dueDate ?? ""}
                      createdAt={d.createdAt}
                      status={d.status}
                      priority={d.priority}
                      completedAt={d.completedAt}
                      expirationReason={d.closure?.expirationReason}
                      compact={true}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DemandList;
