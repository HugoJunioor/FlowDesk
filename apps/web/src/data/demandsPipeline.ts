import { SlackDemand, PRIORITY_CONFIG, ClosureFields, type DemandArea } from "@/types/demand";
import { classifyDemand } from "@/lib/priorityClassifier";
import { processDemandsStatus } from "@/lib/statusAnalyzer";
import { classifyClosureFields } from "@/lib/closureClassifier";
import { fallbackReaches, type AutoAssignRule } from "@/lib/autoAssignRules";

/**
 * Pipeline de processamento das demandas do Slack, sem nenhuma dependencia de
 * browser: regras e overrides entram como parametro em vez de sair do
 * localStorage.
 *
 * Existe separado do demandsLoader pra que o MESMO codigo rode no navegador e
 * nos scripts do servidor (ex: scripts/syncSheets.ts, que exporta chamados pra
 * planilha). Antes disso a unica forma de reproduzir prioridade, status e
 * overrides fora do browser era copiar a logica — e o projeto ja tem tres
 * copias de horario comercial que discordam entre si.
 */

export interface DemandOverride {
  status?: string;
  priority?: string;
  assignee?: string | null;
  completedAt?: string | null;
  manualStatusOverride?: boolean;
  closure?: Partial<ClosureFields>;
  taskLink?: string;
  hasTask?: boolean;
  /** Transferencia entre Suporte e Engenharia (ausente = nunca transferida). */
  area?: DemandArea;
  areaChangedAt?: string;
  areaChangedBy?: string;
}

/** Conteudo de `fd_demand_overrides`: override manual indexado pelo id da demanda. */
export type DemandOverrides = Record<string, DemandOverride>;

// Workflows que sao sempre P3 por definicao operacional (independente do texto).
// Mantemos em lower-case pra comparar sem se preocupar com acento/caixa.
const FORCED_P3_WORKFLOWS = [
  "nova conciliacao", "nova conciliação",
];

export function autoClassifyDemands(demands: SlackDemand[], rules: AutoAssignRule[]): SlackDemand[] {
  const textRules = rules.filter((r) => r.condition === "text_match");
  const fallbackRule = rules.find((r) => r.condition === "no_assignee");

  return demands.map((d) => {
    const titleLower = d.title.toLowerCase();
    const workflowLower = d.workflow.toLowerCase();

    // Workflow forcado P3 (conciliacao etc) — sobrepoe a PRIORIDADE, nao a
    // atribuicao de responsavel. Sao duas decisoes diferentes, e antes este
    // bloco saia com `return` antes das etapas 1 e 2: demanda de "Nova
    // conciliacao" nunca recebia responsavel, nem por regra de texto nem pelo
    // fallback. Em producao isso deixou 58 demandas permanentemente sem dono,
    // e o time atribuia na mao sem saber por que a regra nao pegava.
    //
    // Aqui aplicamos so o fallback, nao as regras por texto: o pedido e
    // "se vier sem responsavel, atribui a quem esta configurado". Quem ja tem
    // dono continua intocado.
    if (FORCED_P3_WORKFLOWS.includes(workflowLower)) {
      const forced: SlackDemand = {
        ...d,
        priority: "p3",
        autoClassification: {
          priority: "p3" as const,
          confidence: "alta" as const,
          reason: `Workflow "${d.workflow}" classificado como P3 por definicao operacional.`,
          matchedKeywords: [d.workflow],
        },
      };
      if (fallbackRule && !forced.assignee?.name && fallbackReaches(fallbackRule, d.createdAt)) {
        forced.assignee = { name: fallbackRule.assignee, avatar: "" };
        // A prioridade da regra NAO se aplica aqui: o P3 do workflow vence.
      }
      return forced;
    }

    // 1) Regras dinâmicas por texto (título/workflow)
    for (const rule of textRules) {
      const pattern = rule.pattern ?? "";
      if (!pattern) continue;
      const value = rule.field === "workflow" ? workflowLower : titleLower;
      const matched = rule.match === "equals"
        ? value === pattern.toLowerCase()
        : value.includes(pattern.toLowerCase());
      if (matched) {
        return {
          ...d,
          assignee: { name: rule.assignee, avatar: "" },
          priority: (rule.priority as SlackDemand["priority"]) || d.priority,
        };
      }
    }

    const classification = classifyDemand(d.title, d.description);
    const result: SlackDemand = { ...d, autoClassification: classification };

    // 2) Fallback: demanda sem responsável → aplica regra "no_assignee" se houver
    //    e se ela alcançar a data de criação da demanda (ver appliesFrom).
    if (fallbackRule && (!result.assignee || !result.assignee.name) && fallbackReaches(fallbackRule, d.createdAt)) {
      result.assignee = { name: fallbackRule.assignee, avatar: "" };
      if (fallbackRule.priority) {
        result.priority = fallbackRule.priority as SlackDemand["priority"];
      }
    }

    // Sem_classificacao: se o classificador encontrou um p1/p2/p3, adota.
    // Senao, mantem sem_classificacao mesmo.
    if (d.priority === "sem_classificacao") {
      if (classification.priority !== "sem_classificacao") {
        result.priority = classification.priority;
        result.autoClassification = {
          ...classification,
          reason: `Classificada automaticamente como ${PRIORITY_CONFIG[classification.priority].label}. ${classification.reason}`,
        };
      }
      return result;
    }

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

export function applyOverrides(demands: SlackDemand[], overrides: DemandOverrides): SlackDemand[] {
  return demands.map((d) => {
    const ov = overrides[d.id];
    if (!ov) return d;

    // REGRA: so sobrepor override manual se a conclusao foi detectada AGORA
    // via circulo verde na thread (closureSource === 'green_circle').
    // Se a demanda esta como concluida apenas por preservacao do sync
    // anterior, o override do usuario prevalece (ele deve ter reaberto
    // conscientemente).
    const closureSource = (d as SlackDemand & { closureSource?: string }).closureSource;
    const syncConcludedViaReaction =
      d.status === "concluida" && d.completedAt && closureSource === "green_circle";
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
      taskLink: ov.taskLink !== undefined ? ov.taskLink : d.taskLink,
      hasTask: ov.hasTask !== undefined ? ov.hasTask : d.hasTask,
      area: ov.area ?? d.area,
      areaChangedAt: ov.areaChangedAt ?? d.areaChangedAt,
      areaChangedBy: ov.areaChangedBy ?? d.areaChangedBy,
    };
  });
}

/**
 * Demandas atuais (vindas do sync) completamente processadas: classificadas,
 * com status analisado, closure e overrides — exatamente o que a UI mostra.
 */
export function processCurrentDemands(
  demands: SlackDemand[],
  { rules, overrides }: { rules: AutoAssignRule[]; overrides: DemandOverrides },
): SlackDemand[] {
  const classified = autoClassifyDemands(demands, rules);
  const analyzed = processDemandsStatus(classified);
  const withClosure = analyzed.map((d) => ({
    ...d,
    closure: d.closure || classifyClosureFields(d),
  }));
  return applyOverrides(withClosure, overrides);
}
