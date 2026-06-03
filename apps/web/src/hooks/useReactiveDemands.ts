import { useEffect, useState } from "react";
import { getProcessedDemands, subscribeToSync } from "@/data/demandsLoader";
import type { SlackDemand } from "@/types/demand";

/**
 * Versao reativa de `getProcessedDemands()`: re-renderiza automaticamente em 3 casos:
 *
 * 1. Storage event `fd_demand_overrides` (mudanca em outra aba ou via UI)
 * 2. Sync polling detectou novo `realDemands.ts` (auto-refresh sem F5)
 * 3. Mudanca em chaves correlatas: regras de auto-atribuicao, canais de
 *    roteamento (afetam o autoClassifyDemands)
 *
 * Drop-in replacement para componentes que faziam:
 *    const [demands, setDemands] = useState(() => getProcessedDemands());
 *
 * Substitui por:
 *    const demands = useReactiveDemands();
 */
export function useReactiveDemands(): SlackDemand[] {
  const [demands, setDemands] = useState<SlackDemand[]>(() => getProcessedDemands());

  useEffect(() => {
    const refresh = (): void => setDemands(getProcessedDemands());

    // Storage events (mudancas em outra aba ou via setItem aqui mesmo)
    const handleStorage = (e: StorageEvent): void => {
      if (
        e.key === "fd_demand_overrides" ||
        e.key === "fd_auto_assign_rules" ||
        e.key === "fd_channel_routing"
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", handleStorage);

    // Sync polling (auto-refresh do backend)
    const unsubSync = subscribeToSync(refresh);

    return () => {
      window.removeEventListener("storage", handleStorage);
      unsubSync();
    };
  }, []);

  return demands;
}
