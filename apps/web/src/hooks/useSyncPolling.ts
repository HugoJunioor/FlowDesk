import { useEffect, useRef } from "react";
import { updateRuntimeDemands } from "@/data/demandsLoader";

/**
 * Polling de auto-refresh contra o backend.
 *
 * A cada `POLL_INTERVAL_MS` consulta `GET /sync-status`. Se o mtime de
 * `realDemands.ts` mudou desde a ultima checagem, busca `GET /demands-snapshot`
 * e atualiza o cache runtime de demandsLoader — todos os componentes
 * inscritos via `subscribeToSync()` re-renderizam com os dados novos.
 *
 * Sem F5, sem perder scroll, modal aberto ou filtro selecionado.
 *
 * Use em componente top-level (ex: App.tsx) — uma instancia por sessao.
 */

const POLL_INTERVAL_MS = 30_000;

// Endpoints servidos pelo legacy-state (Traefik /sync-status e /demands-snapshot)
const STATUS_URL = "/sync-status";
const SNAPSHOT_URL = "/demands-snapshot";

export function useSyncPolling(): void {
  const lastMtime = useRef<number | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    async function tick(): Promise<void> {
      if (stopped.current) return;

      try {
        const statusRes = await fetch(STATUS_URL, { credentials: "include" });
        if (!statusRes.ok) throw new Error(`status ${statusRes.status}`);
        const { mtime } = (await statusRes.json()) as { mtime: number };

        if (typeof mtime === "number" && mtime !== lastMtime.current) {
          const snapRes = await fetch(SNAPSHOT_URL, { credentials: "include" });
          if (!snapRes.ok) throw new Error(`snapshot ${snapRes.status}`);
          const { demands } = (await snapRes.json()) as { demands: unknown[] };
          if (Array.isArray(demands)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateRuntimeDemands(demands as any);
            lastMtime.current = mtime;
          }
        }
      } catch {
        // Falha silenciosa — proxima iteracao tenta de novo
      }

      if (!stopped.current) {
        window.setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    // Primeira execucao quase imediata (apos 2s pra nao competir com mount inicial)
    const initialTimer = window.setTimeout(tick, 2_000);

    return () => {
      stopped.current = true;
      window.clearTimeout(initialTimer);
    };
  }, []);
}
