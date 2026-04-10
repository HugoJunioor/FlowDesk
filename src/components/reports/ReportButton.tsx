import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlackDemand } from "@/types/demand";
import { generateInteractiveReport } from "@/lib/reportGenerator";
import { branding } from "@/config/brandingLoader";

interface ReportButtonProps {
  demands: SlackDemand[];
  filters?: Record<string, string>;
  source: "dashboard" | "demandas";
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const ReportButton = ({ demands, filters, source, variant = "outline", size = "sm" }: ReportButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = async () => {
    setIsGenerating(true);

    // Small delay for UX feedback
    await new Promise((r) => setTimeout(r, 300));

    try {
      const title = source === "dashboard"
        ? `Relatório Analítico - ${branding.name}`
        : `Relatório de Demandas - ${branding.name}`;

      const subtitle = source === "dashboard"
        ? "Visão consolidada de indicadores e métricas"
        : "Detalhamento completo das demandas";

      const html = generateInteractiveReport({
        title,
        subtitle,
        filters,
        demands,
        generatedFrom: source,
      });

      // Download as HTML
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `relatorio-${source}-${dateStr}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Erro ao gerar relatório:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isGenerating || demands.length === 0}
      className="gap-2"
    >
      {isGenerating ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <FileDown size={14} />
      )}
      <span className="hidden sm:inline">
        {isGenerating ? "Gerando..." : "Relatório"}
      </span>
    </Button>
  );
};

export default ReportButton;
