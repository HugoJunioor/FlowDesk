/**
 * Auto-assignment rules — CRUD over localStorage key `fd_auto_assign_rules`.
 *
 * Two rule types:
 *   - text_match: legacy form, matches by title/workflow contents (default for
 *     entries without `condition` so old rules keep working).
 *   - no_assignee: fallback applied only when the demand still has no
 *     responsible after text rules ran. Implements the "default responsible
 *     for Slack demands without an assignee" requirement.
 *
 * Persistence is plain localStorage + the standard stateSync mechanism — the
 * key is already in the SYNCED_KEYS list so changes propagate across browsers.
 */

const STORAGE_KEY = "fd_auto_assign_rules";

export type AutoAssignCondition = "text_match" | "no_assignee";

export interface AutoAssignRule {
  id: string;
  condition: AutoAssignCondition;
  assignee: string;
  priority?: string;
  /**
   * no_assignee-only: data (YYYY-MM-DD) a partir da qual o fallback vale,
   * comparada contra `createdAt` da demanda.
   *
   * Existe porque o fallback e aplicado na carga, sobre a base inteira — sem
   * recorte, criar a regra transfere de uma vez todo o historico sem dono (em
   * producao, 133 demandas desde abril, 126 delas ja concluidas) e distorce as
   * metricas por responsavel. Ausente = vale pra tudo, que era o comportamento
   * antes deste campo existir.
   */
  appliesFrom?: string;
  // text_match-only fields:
  pattern?: string;
  field?: "title" | "workflow";
  match?: "includes" | "equals";
}

/** Hoje em YYYY-MM-DD, hora local — o padrao de "daqui pra frente". */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * A regra de fallback alcanca esta demanda?
 *
 * `appliesFrom` e interpretado como meia-noite LOCAL, nao UTC: o usuario
 * escolhe "a partir de hoje" pensando no fuso dele, e uma demanda criada as
 * 22h de ontem (01h UTC de hoje) nao deve ser capturada por engano.
 */
export function fallbackReaches(rule: AutoAssignRule, demandCreatedAt: string): boolean {
  if (!rule.appliesFrom) return true;
  const from = new Date(`${rule.appliesFrom}T00:00:00`).getTime();
  if (Number.isNaN(from)) return true; // data corrompida nao deve desligar a regra
  const created = new Date(demandCreatedAt).getTime();
  if (Number.isNaN(created)) return false;
  return created >= from;
}

type StoredRule = Partial<AutoAssignRule> & { assignee: string };

function genId(): string {
  return `aar_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function normalize(raw: StoredRule): AutoAssignRule {
  const condition: AutoAssignCondition = raw.condition === "no_assignee" ? "no_assignee" : "text_match";
  return {
    id: raw.id || genId(),
    condition,
    assignee: raw.assignee,
    priority: raw.priority,
    // Regras salvas antes deste campo existir ficam sem appliesFrom e seguem
    // valendo pra base inteira — nao mudamos o alcance de nada ja configurado.
    appliesFrom: condition === "no_assignee" ? raw.appliesFrom : undefined,
    pattern: condition === "text_match" ? (raw.pattern ?? "") : undefined,
    field: condition === "text_match" ? (raw.field ?? "title") : undefined,
    match: condition === "text_match" ? (raw.match ?? "includes") : undefined,
  };
}

export function loadAutoAssignRules(): AutoAssignRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: StoredRule[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize);
  } catch {
    return [];
  }
}

export function saveAutoAssignRules(rules: AutoAssignRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function upsertAutoAssignRule(rule: AutoAssignRule): AutoAssignRule[] {
  const rules = loadAutoAssignRules();
  const idx = rules.findIndex((r) => r.id === rule.id);
  if (idx >= 0) rules[idx] = rule;
  else rules.push(rule);
  saveAutoAssignRules(rules);
  return rules;
}

export function deleteAutoAssignRule(id: string): AutoAssignRule[] {
  const rules = loadAutoAssignRules().filter((r) => r.id !== id);
  saveAutoAssignRules(rules);
  return rules;
}

export function newRule(condition: AutoAssignCondition): AutoAssignRule {
  return normalize({
    id: genId(),
    condition,
    assignee: "",
    // Fallback novo nasce valendo so de hoje em diante: e o que se espera ao
    // ligar a regra, e evita a surpresa de herdar meses de historico sem dono.
    // O campo fica editavel na UI pra quem quiser alcance maior.
    ...(condition === "no_assignee" ? { appliesFrom: todayIso() } : {}),
  });
}
