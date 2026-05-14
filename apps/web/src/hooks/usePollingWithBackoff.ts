/**
 * usePollingWithBackoff
 *
 * Executa um callback em intervalo fixo e para automaticamente ao detectar
 * erro 401 (Unauthorized). Resume quando:
 *   - janela ganha foco (visibilitychange: visible)
 *   - usuario interage com a pagina (click global)
 *
 * Uso:
 *   const { paused } = usePollingWithBackoff(fetchFn, 30_000, enabled);
 */
import { useEffect, useRef, useCallback, useState } from "react";

const UNAUTHORIZED_RE = /unauthorized|401/i;

function isUnauthorizedError(err: unknown): boolean {
  if (err instanceof Error) return UNAUTHORIZED_RE.test(err.message);
  if (typeof err === "string") return UNAUTHORIZED_RE.test(err);
  return false;
}

interface UsePollingWithBackoffOptions {
  /** Se false, nao inicia o polling (ex: usuario nao logado). Default: true */
  enabled?: boolean;
}

interface UsePollingWithBackoffResult {
  /** true quando polling foi pausado por 401 */
  paused: boolean;
  /** Forca uma execucao imediata (e resume se pausado) */
  runNow: () => void;
}

export function usePollingWithBackoff(
  callback: () => Promise<void>,
  intervalMs: number,
  options: UsePollingWithBackoffOptions = {}
): UsePollingWithBackoffResult {
  const { enabled = true } = options;

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(callback);

  // Mantem referencia atualizada sem recriar o intervalo
  useEffect(() => {
    callbackRef.current = callback;
  });

  const clearPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    clearPolling();
    if (!enabled) return;
    intervalRef.current = setInterval(async () => {
      if (pausedRef.current) return;
      try {
        await callbackRef.current();
      } catch (err) {
        if (isUnauthorizedError(err)) {
          pausedRef.current = true;
          setPaused(true);
          clearPolling();
          console.warn("[usePollingWithBackoff] 401 detectado — polling pausado");
        }
      }
    }, intervalMs);
  }, [enabled, intervalMs, clearPolling]);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    arm();
    // Executa imediatamente ao resumir
    void callbackRef.current().catch(() => {/* silencia no resume imediato */});
  }, [arm]);

  const runNow = useCallback(() => {
    resume();
    void callbackRef.current().catch(() => {});
  }, [resume]);

  // Inicia polling quando enabled muda
  useEffect(() => {
    if (!enabled) {
      clearPolling();
      return;
    }
    pausedRef.current = false;
    setPaused(false);
    arm();
    return clearPolling;
  }, [enabled, arm, clearPolling]);

  // Resume por visibilitychange
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [resume]);

  // Resume por qualquer click do usuario
  useEffect(() => {
    window.addEventListener("click", resume);
    return () => window.removeEventListener("click", resume);
  }, [resume]);

  return { paused, runNow };
}
