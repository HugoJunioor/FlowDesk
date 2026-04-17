import { SlackDemand } from "@/types/demand";

/**
 * Loader isolado das demandas do canal #operacoes-sql.
 * NAO se mistura com as demandas dos outros canais nos relatorios/metricas.
 *
 * Carrega sqlDemands.ts se existir, senao retorna array vazio.
 */
const modules = import.meta.glob<{ sqlDemands: SlackDemand[] }>("./sqlDemands.ts", {
  eager: true,
});
const module = Object.values(modules)[0];

export const sqlDemands: SlackDemand[] = module?.sqlDemands ?? [];
export const hasSqlData = !!module;

/** Aplica overrides manuais do localStorage (chave separada do fluxo principal) */
function loadSqlOverrides(): Record<
  string,
  {
    status?: string;
    completedAt?: string | null;
    manualStatusOverride?: boolean;
    assignee?: string | null;
  }
> {
  try {
    const stored = localStorage.getItem("fd_sql_demand_overrides");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function applySqlOverrides(demands: SlackDemand[]): SlackDemand[] {
  const overrides = loadSqlOverrides();
  return demands.map((d) => {
    const ov = overrides[d.id];
    if (!ov) return d;
    const hasManualStatus = ov.manualStatusOverride && ov.status;
    return {
      ...d,
      status: hasManualStatus ? (ov.status as SlackDemand["status"]) : ((ov.status as SlackDemand["status"]) || d.status),
      assignee: ov.assignee !== undefined ? (ov.assignee ? { name: ov.assignee, avatar: "" } : null) : d.assignee,
      completedAt: ov.completedAt !== undefined ? ov.completedAt : d.completedAt,
      manualStatusOverride: ov.manualStatusOverride || false,
    };
  });
}

export function getProcessedSqlDemands(): SlackDemand[] {
  return applySqlOverrides(sqlDemands);
}
