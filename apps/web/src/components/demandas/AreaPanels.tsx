import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Headset, Wrench } from "lucide-react";
import { PRIORITY_CONFIG, type DemandArea, type SlackDemand } from "@/types/demand";
import { useLanguage } from "@/contexts/LanguageContext";

const AREAS: DemandArea[] = ["suporte", "engenharia"];

/**
 * Cores fixas por area, de proposito fora do sistema de temas: a ideia e bater
 * o olho e saber em que area se esta, independente do tema escolhido.
 */
const STYLE: Record<DemandArea, { panel: string; title: string; sub: string; icon: typeof Wrench; labelKey: string }> = {
  suporte: {
    panel: "bg-indigo-600 dark:bg-indigo-800",
    title: "text-white",
    sub: "text-indigo-100",
    icon: Headset,
    labelKey: "demand.area.support",
  },
  engenharia: {
    panel: "bg-yellow-300 dark:bg-yellow-400",
    title: "text-yellow-950",
    sub: "text-yellow-900",
    icon: Wrench,
    labelKey: "demand.area.engineering",
  },
};

interface AreaPanelsProps {
  active: DemandArea;
  onActivate: (area: DemandArea) => void;
  counts: Record<DemandArea, number>;
  /** Demandas mostradas na faixa recolhida (as mais recentes da area). */
  previews: Record<DemandArea, SlackDemand[]>;
  /** Conteudo da area aberta (indicadores, filtros, kanban/lista). */
  children: ReactNode;
}

/**
 * Duas areas lado a lado: a aberta ocupa o espaco, a outra fica recolhida
 * numa faixa no canto. Clicar na faixa troca as duas. Operacoes sempre a
 * esquerda, Engenharia sempre a direita — a posicao nao muda, so o tamanho.
 */
const AreaPanels = ({ active, onActivate, counts, previews, children }: AreaPanelsProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch">
      {AREAS.map((area) => {
        const s = STYLE[area];
        const Icon = s.icon;

        if (area === active) {
          return (
            <section
              key={area}
              aria-label={t(s.labelKey)}
              className={`flex-1 min-w-0 rounded-2xl p-3 sm:p-4 space-y-4 transition-all duration-300 ${s.panel}`}
            >
              <header className={`flex items-center justify-center gap-2 ${s.title}`}>
                <Icon size={16} />
                <h2 className="text-sm font-semibold tracking-wide">{t(s.labelKey)}</h2>
                <span className={`text-xs tabular-nums ${s.sub}`}>{counts[area]}</span>
              </header>
              {children}
            </section>
          );
        }

        const SideChevron = area === "suporte" ? ChevronRight : ChevronLeft;
        return (
          <button
            key={area}
            type="button"
            onClick={() => onActivate(area)}
            title={t("demand.area.open_panel", { area: t(s.labelKey) })}
            // No celular os paineis empilham: a faixa recolhida sobe pro topo
            // pra nao ficar depois de uma lista longa.
            className={`order-first md:order-none md:w-48 shrink-0 rounded-2xl p-3 text-left flex flex-col justify-start transition-all duration-300 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${s.panel}`}
          >
            <div className={`flex items-center justify-between gap-2 ${s.title}`}>
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Icon size={15} /> {t(s.labelKey)}
              </span>
              <SideChevron size={16} className="hidden md:block" />
            </div>
            <p className={`text-3xl font-bold tabular-nums mt-2 ${s.title}`}>{counts[area]}</p>
            <p className={`text-[11px] ${s.sub}`}>{t("demand.area.open_panel", { area: t(s.labelKey) })}</p>

            {previews[area].length > 0 && (
              <ul className="mt-3 space-y-1.5 hidden md:block">
                {previews[area].map((d) => (
                  <li key={d.id} className="rounded-lg bg-background/90 px-2 py-1.5 text-[11px] leading-snug text-foreground">
                    <span className={`font-semibold ${PRIORITY_CONFIG[d.priority].color}`}>{PRIORITY_CONFIG[d.priority].shortLabel}</span>{" "}
                    <span className="line-clamp-2">{d.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default AreaPanels;
