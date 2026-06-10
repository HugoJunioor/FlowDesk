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
  // text_match-only fields:
  pattern?: string;
  field?: "title" | "workflow";
  match?: "includes" | "equals";
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
  return normalize({ id: genId(), condition, assignee: "" });
}
