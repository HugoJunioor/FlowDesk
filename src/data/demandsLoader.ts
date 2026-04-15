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

// Regras de auto-atribuição configuráveis via localStorage
function loadAutoAssignRules(): { pattern: string; field: "title" | "workflow"; match: "includes" | "equals"; assignee: string; priority?: string }[] {
  try {
    const stored = localStorage.getItem("fd_auto_assign_rules");
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function autoClassifyDemands(demands: SlackDemand[]): SlackDemand[] {
  const rules = loadAutoAssignRules();

  return demands.map((d) => {
    const titleLower = d.title.toLowerCase();
    const workflowLower = d.workflow.toLowerCase();

    // Regras dinâmicas de auto-atribuição (configuradas localmente)
    for (const rule of rules) {
      const value = rule.field === "title" ? titleLower : workflowLower;
      const matched = rule.match === "equals"
        ? value === rule.pattern.toLowerCase()
        : value.includes(rule.pattern.toLowerCase());
      if (matched) {
        return {
          ...d,
          assignee: { name: rule.assignee, avatar: "" },
          priority: (rule.priority as any) || d.priority,
        };
      }
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

    // Override manual SEMPRE tem prioridade — é a ação mais recente do usuário
    const hasManualStatus = ov.manualStatusOverride && ov.status;

    return {
      ...d,
      status: hasManualStatus ? (ov.status as any) : ((ov.status as any) || d.status),
      priority: (ov.priority as any) || d.priority,
      assignee: ov.assignee !== undefined ? (ov.assignee ? { name: ov.assignee, avatar: "" } : null) : d.assignee,
      completedAt: ov.completedAt !== undefined ? ov.completedAt : d.completedAt,
      manualStatusOverride: ov.manualStatusOverride || false,
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
