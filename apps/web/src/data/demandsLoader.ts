import { SlackDemand } from "@/types/demand";
import { mockDemands as demoData, extractClientName } from "./mockDemands";
import { loadAutoAssignRules } from "@/lib/autoAssignRules";
import { applyOverrides, processCurrentDemands, type DemandOverrides } from "./demandsPipeline";

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

const initialDemands: SlackDemand[] = realModule?.mockDemands ?? demoData;
const historicalDemands: SlackDemand[] = histModule?.historicalDemands ?? [];

// === RUNTIME CACHE (auto-refresh sem F5) ===
// `runtimeDemands` substitui o bundle estatico quando o polling de sync
// detecta mudancas em realDemands.ts. Comeca null = usa bundle inicial;
// depois do primeiro fetch bem-sucedido, vira a fonte canonica.
let runtimeDemands: SlackDemand[] | null = null;
const syncListeners = new Set<() => void>();

/** Substitui a fonte runtime e notifica subscribers (re-render). */
export function updateRuntimeDemands(data: SlackDemand[]): void {
  runtimeDemands = data;
  syncListeners.forEach((fn) => {
    try { fn(); } catch { /* listener isolado nao quebra os outros */ }
  });
}

/** Inscreve callback pra ser chamado quando o cache runtime mudar. */
export function subscribeToSync(fn: () => void): () => void {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

// Combinar: historicos (ja concluidos, sem reprocessamento) + atuais
// `baseDemands` agora le do runtime cache se houver, senao do bundle.
function getCurrentDemands(): SlackDemand[] {
  return runtimeDemands ?? initialDemands;
}
export const baseDemands: SlackDemand[] = [...initialDemands]; // backward compat (imports estaticos)
export const isRealData = !!realModule;

// === PROCESSAMENTO COMPARTILHADO ===
// A logica em si vive em demandsPipeline.ts (sem dependencia de browser, pra
// rodar igual nos scripts do servidor). Aqui so entram as fontes do navegador:
// regras e overrides lidos do localStorage.

function loadOverrides(): DemandOverrides {
  try {
    const stored = localStorage.getItem("fd_demand_overrides");
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

/** Demandas completamente processadas: classificadas, com status analisado, closure e overrides */
export function getProcessedDemands(): SlackDemand[] {
  // Processar demandas atuais (abril+): classificar, analisar status, closure.
  // Le do runtime cache se polling ja trouxe dados frescos; senao usa o
  // bundle estatico carregado no momento do build.
  const overrides = loadOverrides();
  const currentProcessed = processCurrentDemands(getCurrentDemands(), {
    rules: loadAutoAssignRules(),
    overrides,
  });

  // Historicos (Jan-Mar): ja vem prontos da planilha+Slack, apenas aplicar overrides locais
  const historicalProcessed = applyOverrides(historicalDemands, overrides);

  return [...currentProcessed, ...historicalProcessed];
}

export { extractClientName };
