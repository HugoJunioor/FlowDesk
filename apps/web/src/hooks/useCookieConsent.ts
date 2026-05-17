import { useState, useCallback } from "react";

const STORAGE_KEY = "flowdesk:cookie-consent:v1";

export interface CookieConsentState {
  necessarios: true;
  funcionais: boolean;
  analitica: boolean;
  decidido_em: string;
}

function readFromStorage(): CookieConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsentState;
  } catch {
    return null;
  }
}

function writeToStorage(state: CookieConsentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function useCookieConsent() {
  const [consent, setConsentState] = useState<CookieConsentState | null>(() =>
    readFromStorage()
  );

  const decidido = consent !== null;

  const aceitar = useCallback((funcionais: boolean, analitica: boolean) => {
    const state: CookieConsentState = {
      necessarios: true,
      funcionais,
      analitica,
      decidido_em: new Date().toISOString(),
    };
    writeToStorage(state);
    setConsentState(state);

    // TODO: POST /api/v1/auditoria quando endpoint de consentimento LGPD for implementado
    // await apiClient.post("/auditoria", { acao: "cookie_consent", detalhes: state });
  }, []);

  const aceitarTodos = useCallback(() => aceitar(true, true), [aceitar]);

  const aceitarNecessarios = useCallback(() => aceitar(false, false), [aceitar]);

  const revogar = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setConsentState(null);
  }, []);

  return { consent, decidido, aceitarTodos, aceitarNecessarios, aceitar, revogar };
}
