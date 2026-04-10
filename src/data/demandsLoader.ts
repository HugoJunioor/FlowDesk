import { SlackDemand, PRIORITY_CONFIG, ClosureFields } from "@/types/demand";
import { mockDemands as demoData, extractClientName } from "./mockDemands";
import { classifyDemand } from "@/lib/priorityClassifier";
import { processDemandsStatus } from "@/lib/statusAnalyzer";
import { classifyClosureFields } from "@/lib/closureClassifier";

/**
 * Carrega demandas: tenta realDemands (dados reais, gitignored),
 * senao usa mockDemands (dados genericos de demo).
 */

// Vite glob: busca realDemands.ts se existir (eager = sync)
const realModules = import.meta.glob<{ mockDemands: SlackDemand[] }>("./realDemands.ts", { eager: true });
const realModule = Object.values(realModules)[0];

export const baseDemands: SlackDemand[] = realModule?.mockDemands ?? demoData;
export const isRealData = !!realModule;

// === PROCESSAMENTO COMPARTILHADO ===

function autoClassifyDemands(demands: SlackDemand[]): SlackDemand[] {
  return demands.map((d) => {
    const titleLower = d.title.toLowerCase();
    const workflowLower = d.workflow.toLowerCase();

    // Rule: Remessa SITEF → Hugo, sem classificacao
    if (workflowLower.includes("remessa") || titleLower.includes("remessa sitef") || titleLower.includes("remessa tef")) {
      return { ...d, assignee: { name: "Hugo Cordeiro Junior", avatar: "" }, priority: "sem_classificacao" as const };
    }
    // Rule: Conciliacao (por workflow) → Daniel, sem classificacao
    if (workflowLower === "nova conciliação" || workflowLower === "nova conciliacao") {
      return { ...d, assignee: { name: "Daniel Bichof", avatar: "" }, priority: "sem_classificacao" as const };
    }

    if (d.priority === "sem_classificacao") return d;

    const classification = classifyDemand(d.title, d.description);
    const result = { ...d, autoClassification: classification };

    if (classification.priority !== "sem_classificacao" && classification.priority !== d.priority) {
      result.autoClassification = {
        ...classification,
        reason: `Reclassificado de ${PRIORITY_CONFIG[d.priority].label} para ${PRIORITY_CONFIG[classification.priority].label}. ${classification.reason}`,
      };
      result.priority = classification.priority;
    } else {
      result.autoClassification = {
        ...classification,
        priority: d.priority,
        reason: `Classificacao original confirmada como ${PRIORITY_CONFIG[d.priority].label}. ${classification.reason}`,
      };
    }

    return result;
  });
}

function loadOverrides(): Record<string, { status?: string; priority?: string; assignee?: string | null; completedAt?: string | null; manualStatusOverride?: boolean; closure?: Partial<ClosureFields> }> {
  try {
    const stored = localStorage.getItem("fd_demand_overrides");
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function applyOverrides(demands: SlackDemand[]): SlackDemand[] {
  const overrides = loadOverrides();
  return demands.map((d) => {
    const ov = overrides[d.id];
    if (!ov) return d;

    // Se o sync detectou conclusao (check reaction) e o override manual era um status inferior,
    // o sync tem prioridade — remove o override desatualizado
    const syncConcluded = d.status === "concluida" && d.completedAt;
    const overrideStatus = syncConcluded ? d.status : ((ov.status as any) || d.status);
    const overrideCompleted = syncConcluded ? d.completedAt : (ov.completedAt !== undefined ? ov.completedAt : d.completedAt);

    return {
      ...d,
      status: overrideStatus,
      priority: (ov.priority as any) || d.priority,
      assignee: ov.assignee !== undefined ? (ov.assignee ? { name: ov.assignee, avatar: "" } : null) : d.assignee,
      completedAt: overrideCompleted,
      manualStatusOverride: syncConcluded ? false : (ov.manualStatusOverride || d.manualStatusOverride),
      closure: ov.closure ? { ...(d.closure || { category: "", expirationReason: "", supportLevel: "", internalComment: "", autoFilled: { category: false, expirationReason: false, supportLevel: false } }), ...ov.closure } as ClosureFields : d.closure,
    };
  });
}

/** Demandas completamente processadas: classificadas, com status analisado, closure e overrides */
export function getProcessedDemands(): SlackDemand[] {
  const classified = autoClassifyDemands(baseDemands);
  const analyzed = processDemandsStatus(classified);
  const withClosure = analyzed.map((d) => ({
    ...d,
    closure: d.closure || classifyClosureFields(d),
  }));
  return applyOverrides(withClosure);
}

export { extractClientName };
