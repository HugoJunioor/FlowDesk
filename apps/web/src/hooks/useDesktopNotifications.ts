/**
 * useDesktopNotifications
 *
 * Gerencia permissao de notificacoes desktop (Notification API) e
 * expoe funcao throttled pra disparar notificacoes por categoria.
 *
 * Throttle: max 1 notificacao por categoria a cada 30s pra nao spammar.
 * Preferencia do usuario persiste em localStorage.
 *
 * Uso:
 *   const { permission, enabled, requestPermission, notify, setEnabled } =
 *     useDesktopNotifications();
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  getPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  type PermissionState,
} from "@/lib/browserNotifications";

const LS_KEY = "flowdesk:desktop-notifications:enabled";
const THROTTLE_MS = 30_000;

function loadEnabled(): boolean {
  try {
    const v = localStorage.getItem(LS_KEY);
    // Se nunca foi definido, default false (user precisa opt-in)
    return v === "true";
  } catch {
    return false;
  }
}

function saveEnabled(v: boolean): void {
  try {
    localStorage.setItem(LS_KEY, String(v));
  } catch {
    /* storage cheio, ignora */
  }
}

export interface NotifyOptions {
  /** Categoria usada pra throttle (ex: "demand_created", "demand_replied") */
  category: string;
  title: string;
  body: string;
  /** ID unico da notificacao — evita duplicata via browserNotifications */
  tag?: string;
  url?: string;
}

export interface UseDesktopNotificationsResult {
  permission: PermissionState;
  /** Se o usuario ativou notificacoes desktop (opt-in) */
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Pede permissao ao browser (deve ser chamado em handler de click) */
  requestPermission: () => Promise<PermissionState>;
  /**
   * Dispara notificacao desktop se enabled + granted + throttle ok.
   * Retorna true se exibiu.
   */
  notify: (opts: NotifyOptions) => boolean;
}

export function useDesktopNotifications(): UseDesktopNotificationsResult {
  const [permission, setPermission] = useState<PermissionState>(getPermission);
  const [enabled, setEnabledState] = useState<boolean>(loadEnabled);

  // Mapa categoria -> timestamp da ultima notificacao exibida
  const lastNotifiedRef = useRef<Map<string, number>>(new Map());

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    saveEnabled(v);
  }, []);

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    const result = await requestBrowserNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  const notify = useCallback(
    (opts: NotifyOptions): boolean => {
      if (!enabled) return false;
      if (permission !== "granted") return false;

      const now = Date.now();
      const lastShown = lastNotifiedRef.current.get(opts.category) ?? 0;
      if (now - lastShown < THROTTLE_MS) return false;

      const shown = showBrowserNotification({
        title: opts.title,
        body: opts.body,
        tag: opts.tag,
        url: opts.url,
      });

      if (shown) {
        lastNotifiedRef.current.set(opts.category, now);
      }
      return shown;
    },
    [enabled, permission]
  );

  // Sincroniza permissao se o user mudar nas configuracoes do browser
  useEffect(() => {
    const id = setInterval(() => {
      const current = getPermission();
      setPermission((prev) => (prev !== current ? current : prev));
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  return { permission, enabled, setEnabled, requestPermission, notify };
}
