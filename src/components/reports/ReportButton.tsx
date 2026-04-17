import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlackDemand } from "@/types/demand";
import { generateInteractiveReport } from "@/lib/reportGenerator";
import { branding } from "@/config/brandingLoader";
import { exportToExcel } from "@/lib/excelExporter";

interface ReportButtonProps {
  demands: SlackDemand[];
  filters?: Record<string, string>;
  source: "dashboard" | "demandas";
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const ReportButton = ({ demands, filters, source, variant = "outline", size = "sm" }: ReportButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportBI = async () => {
    setIsGenerating(true);

    // Small delay for UX feedback
    await new Promise((r) => setTimeout(r, 300));

    try {
      const title = source === "dashboard"
        ? "Relatório Analítico"
        : "Relatório de Demandas";

      // Detect client filter: key can be "Cliente" (dashboard) or "client"
      const clientFilterValue = filters
        ? (filters["Cliente"] || filters["client"] || "")
        : "";
      const subtitle = clientFilterValue
        ? clientFilterValue
        : "Just";

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

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const title = source === "dashboard"
        ? "Relatório Analítico"
        : "Relatório de Demandas";
      exportToExcel(demands, title);
    } catch (e) {
      console.error("Erro ao exportar Excel:", e);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="flex gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={handleExportBI}
        disabled={isGenerating || demands.length === 0}
        className="gap-1"
      >
        {isGenerating ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileDown size={14} />
        )}
        <span className="hidden sm:inline ml-1">
          {isGenerating ? "" : "BI"}
        </span>
      </Button>
      <Button
        variant={variant}
        size={size}
        onClick={handleExportExcel}
        disabled={isExportingExcel || demands.length === 0}
        className="gap-1"
      >
        {isExportingExcel ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileSpreadsheet size={14} />
        )}
        <span className="hidden sm:inline ml-1">
          {isExportingExcel ? "" : "Excel"}
        </span>
      </Button>
    </div>
  );
};

export default ReportButton;
