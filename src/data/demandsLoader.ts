import { SlackDemand, PRIORITY_CONFIG, ClosureFields } from "@/types/demand";
import { mockDemands as demoData, extractClientName } from "./mockDemands";
import { classifyDemand } from "@/lib/priorityClassifier";
import { processDemandsStatus } from "@/lib/statusAnalyzer";
import { classifyClosureFields } from "@/lib/closureClassifier";

/**
 * Carrega demandas: tenta realDemands (dados reais, gitignored),
 * senao usa mockDemands (dados genericos de demo).
 * Tambem carrega historicalDemands (Jan-Mar, importados da planilha + Slack).
 */

// Vite glob: busca realDemands.ts se existir (eager = sync)
const realModules = import.meta.glob<{ mockDemands: SlackDemand[] }>("./realDemands.ts", { eager: true });
const realModule = Object.values(realModules)[0];

// Vite glob: busca historicalDemands.ts se existir (eager = sync)
const histModules = import.meta.glob<{ historicalDemands: SlackDemand[] }>("./historicalDemands.ts", { eager: true });
const histModule = Object.values(histModules)[0];

const currentDemands: SlackDemand[] = realModule?.mockDemands ?? demoData;
const historicalDemands: SlackDemand[] = histModule?.historicalDemands ?? [];

// Combinar: historicos (ja concluidos, sem reprocessamento) + atuais
export const baseDemands: SlackDemand[] = [...currentDemands];
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

    // REGRA: se o sync detectou conclusao no Slack (via 🟢),
    // isso tem prioridade sobre override manual anterior.
    // Assim, quando alguem reage com circulo verde depois de o sistema
    // ja ter sido marcado manualmente, o 🟢 prevalece.
    const syncConcludedViaReaction = d.status === "concluida" && d.completedAt;
    const hasManualStatus = ov.manualStatusOverride && ov.status && !syncConcludedViaReaction;

    return {
      ...d,
      status: syncConcludedViaReaction
        ? d.status
        : hasManualStatus
        ? (ov.status as any)
        : ((ov.status as any) || d.status),
      priority: (ov.priority as any) || d.priority,
      assignee: ov.assignee !== undefined ? (ov.assignee ? { name: ov.assignee, avatar: "" } : null) : d.assignee,
      completedAt: syncConcludedViaReaction
        ? d.completedAt
        : ov.completedAt !== undefined
        ? ov.completedAt
        : d.completedAt,
      manualStatusOverride: syncConcludedViaReaction ? false : ov.manualStatusOverride || false,
      closure: ov.closure ? { ...(d.closure || { category: "", expirationReason: "", supportLevel: "", internalComment: "", autoFilled: { category: false, expirationReason: false, supportLevel: false } }), ...ov.closure } as ClosureFields : d.closure,
    };
  });
}

/** Demandas completamente processadas: classificadas, com status analisado, closure e overrides */
export function getProcessedDemands(): SlackDemand[] {
  // Processar demandas atuais (abril+): classificar, analisar status, closure
  const classified = autoClassifyDemands(baseDemands);
  const analyzed = processDemandsStatus(classified);
  const withClosure = analyzed.map((d) => ({
    ...d,
    closure: d.closure || classifyClosureFields(d),
  }));
  const currentProcessed = applyOverrides(withClosure);

  // Historicos (Jan-Mar): ja vem prontos da planilha+Slack, apenas aplicar overrides locais
  const historicalProcessed = applyOverrides(historicalDemands);

  return [...currentProcessed, ...historicalProcessed];
}

export { extractClientName };
