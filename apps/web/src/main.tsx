import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { branding } from "./config/brandingLoader";
import { initStateSync, installLocalStorageInterceptor } from "./lib/stateSync";
import { initSentry } from "./lib/observability/sentry";

// Sentry primeiro — captura erros que ocorram no bootstrap.
// No-op se VITE_SENTRY_DSN nao estiver setado.
initSentry();

// Auto-reload quando ha SPA chunk hash mismatch (acontece apos deploy: o
// index.html no browser referencia chunks deletados pelo novo build).
// Detecta o erro caracteristico do dynamic import e recarrega — uma vez por
// sessao, pra nao virar loop.
function setupChunkReload(): void {
  const RELOAD_FLAG = '__flowdesk_chunk_reload__';
  const isChunkError = (msg: string): boolean =>
    /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i
      .test(msg);
  const tryReload = (msg: string): void => {
    if (!isChunkError(msg)) return;
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
    sessionStorage.setItem(RELOAD_FLAG, '1');
    window.location.reload();
  };
  window.addEventListener('error', (e) => tryReload(e.message || ''));
  window.addEventListener('unhandledrejection', (e) =>
    tryReload(String((e.reason && (e.reason.message || e.reason)) || '')),
  );
}
setupChunkReload();

document.title = `${branding.name} - ${branding.subtitle}`;

// Intercepta localStorage.setItem para sincronizar com servidor automaticamente
installLocalStorageInterceptor();

// Sincroniza estado (usuarios, overrides, grupos, regras) com servidor
// antes de renderizar. Se offline, continua usando localStorage.
initStateSync().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
