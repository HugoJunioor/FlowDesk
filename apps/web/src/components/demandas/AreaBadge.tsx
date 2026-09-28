import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { areaOf, type SlackDemand } from "@/types/demand";
import { useLanguage } from "@/contexts/LanguageContext";

interface AreaBadgeProps {
  demand: Pick<SlackDemand, "area">;
  className?: string;
}

/**
 * Selo de "com a Engenharia". Demanda com o Suporte e o padrao e nao ganha
 * selo — so a excecao precisa chamar atencao na lista.
 */
const AreaBadge = ({ demand, className = "" }: AreaBadgeProps) => {
  const { t } = useLanguage();
  if (areaOf(demand) !== "engenharia") return null;
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] bg-primary/10 text-primary flex items-center gap-1 shrink-0 ${className}`}
      title={t("demand.area.engineering")}
    >
      <Wrench size={10} />
      {t("demand.area.engineering")}
    </Badge>
  );
};

export default AreaBadge;
