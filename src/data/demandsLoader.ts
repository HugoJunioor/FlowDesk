import { SlackDemand } from "@/types/demand";
import { mockDemands as demoData, extractClientName } from "./mockDemands";

/**
 * Carrega demandas: tenta realDemands (dados reais, gitignored),
 * senao usa mockDemands (dados genericos de demo).
 */

// Vite glob: busca realDemands.ts se existir (eager = sync)
const realModules = import.meta.glob<{ mockDemands: SlackDemand[] }>("./realDemands.ts", { eager: true });
const realModule = Object.values(realModules)[0];

export const baseDemands: SlackDemand[] = realModule?.mockDemands ?? demoData;
export const isRealData = !!realModule;

export { extractClientName };
