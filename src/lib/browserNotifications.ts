/**
 * Wrapper sobre a Notification API do navegador.
 *
 * Permite disparar notificacoes nativas do SO (Windows, macOS, Linux)
 * a partir do FlowDesk. User precisa autorizar uma vez por origem.
 *
 * Compat: Notification API existe em todos os navegadores modernos.
 * Em ambientes sem suporte (alguns iOS WebViews), funcoes viram no-op.
 */

const STORAGE_KEY_LAST_SHOWN = "fd_last_push_ids";
/** Quantas notificacoes "ja exibidas" lembramos pra nao duplicar */
const MAX_REMEMBERED = 50;

export type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): PermissionState {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission as PermissionState;
}

/**
 * Pede permissao pro user. Retorna o estado final.
 * Browsers modernos exigem que isso seja chamado em resposta a uma
 * acao do user (click), nao em mount/load.
 */
export async function requestBrowserNotificationPermission(): Promise<PermissionState> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch {
    return "denied";
  }
}

interface ShowPushOptions {
  title: string;
  body: string;
  /** ID unico — evita reexibir a mesma notificacao */
  tag?: string;
  /** URL pra navegar quando user clicar */
  url?: string;
  /** Icon URL (default: favicon do site) */
  icon?: string;
}

/** Lista de IDs ja exibidos (persistido em localStorage) */
function loadShownIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_SHOWN);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function rememberShownId(id: string): void {
  const list = loadShownIds();
  if (list.includes(id)) return;
  list.unshift(id);
  // Mantem so os N mais recentes
  const trimmed = list.slice(0, MAX_REMEMBERED);
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SHOWN, JSON.stringify(trimmed));
  } catch { /* storage cheio, ignora */ }
}

/**
 * Exibe uma notificacao no SO. Retorna true se conseguiu.
 *
 * - Nao duplica se o mesmo `tag` ja foi mostrado antes (anti-spam)
 * - Click na notificacao foca a aba do FlowDesk e navega pra `url`
 * - Auto-close apos 8s (alguns browsers ignoram, mas eh hint)
 */
export function showBrowserNotification(opts: ShowPushOptions): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;

  // Anti-duplicacao por tag
  if (opts.tag) {
    const shown = loadShownIds();
    if (shown.includes(opts.tag)) return false;
  }

  try {
    const notif = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      icon: opts.icon || "/favicon.ico",
      badge: "/favicon.ico",
      // requireInteraction false = auto-fecha apos alguns segundos
      requireInteraction: false,
    });

    if (opts.url) {
      notif.onclick = () => {
        window.focus();
        if (window.location.pathname + window.location.search !== opts.url) {
          window.location.href = opts.url!;
        }
        notif.close();
      };
    }

    if (opts.tag) rememberShownId(opts.tag);
    return true;
  } catch (e) {
    console.warn("[browserNotifications] erro ao exibir:", e);
    return false;
  }
}
