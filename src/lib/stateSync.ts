/**
 * Sincroniza chaves do localStorage com um arquivo compartilhado no servidor.
 *
 * Autenticacao: o servidor exige header X-FlowDesk-Token. No boot, tentamos
 * pegar o token via GET /__token (so funciona em loopback do master). Em
 * outros dispositivos (VPN), o token deve vir via cookie HttpOnly setado
 * previamente, OU armazenado em sessionStorage manualmente.
 */

const SYNCED_KEYS = [
  "fd_users_v2",
  "fd_demand_overrides",
  "fd_sql_demand_overrides",
  "fd_groups",
  "fd_group_permissions",
  "fd_auto_assign_rules",
  "fd_support_members",
  "fd_channel_routing",
] as const;

type SyncedKey = typeof SYNCED_KEYS[number];

const ENDPOINT = "/__state";
const TOKEN_KEY = "fd_state_token";

let initialized = false;
let authToken: string | null = null;

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(t: string): void {
  authToken = t;
  try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
}

async function fetchTokenFromServer(): Promise<string | null> {
  try {
    const res = await fetch("/__token", { method: "GET", credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  return authToken ? { "X-FlowDesk-Token": authToken } : {};
}

/** Busca estado do servidor e sobrescreve chaves locais. Chamar no startup. */
export async function initStateSync(): Promise<void> {
  if (initialized) return;

  // 1) Tentar token armazenado, depois /__token (loopback do master)
  authToken = getStoredToken();
  if (!authToken) {
    const t = await fetchTokenFromServer();
    if (t) storeToken(t);
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "GET",
      headers: authHeaders(),
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const serverState = (await res.json()) as Partial<Record<SyncedKey, unknown>>;

    for (const key of SYNCED_KEYS) {
      const value = serverState[key];
      if (value !== undefined && value !== null) {
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        const local = localStorage.getItem(key);
        if (local) {
          try {
            await pushToServer(key, JSON.parse(local));
          } catch { /* ignore */ }
        }
      }
    }
    console.log("[stateSync] Estado sincronizado com servidor");
  } catch (err) {
    console.warn("[stateSync] Servidor de estado indisponivel, usando localStorage:", err);
  }
  initialized = true;
}

async function pushToServer(key: SyncedKey, value: unknown): Promise<void> {
  try {
    await fetch(`${ENDPOINT}/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(value),
    });
  } catch (err) {
    console.warn(`[stateSync] Falha ao enviar "${key}" ao servidor:`, err);
  }
}

/** Permite injetar token manualmente (admin compartilha via canal seguro). */
export function setAuthToken(token: string): void {
  storeToken(token);
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Verifica se uma chave e sincronizada */
export function isSynced(key: string): key is SyncedKey {
  return (SYNCED_KEYS as readonly string[]).includes(key);
}

/**
 * Wrapper de localStorage.setItem que tambem envia ao servidor se a chave
 * estiver marcada como sincronizada. Fire-and-forget.
 */
export function setSyncedItem(key: string, value: string): void {
  localStorage.setItem(key, value);
  if (isSynced(key)) {
    try {
      const parsed = JSON.parse(value);
      void pushToServer(key, parsed);
    } catch {
      // valor nao e JSON valido, ignora push
    }
  }
}

/** Monkey-patch opcional para fazer todo localStorage.setItem sincronizar */
export function installLocalStorageInterceptor(): void {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    original.call(this, key, value);
    if (this === window.localStorage && isSynced(key)) {
      try {
        void pushToServer(key as SyncedKey, JSON.parse(value));
      } catch { /* ignore non-JSON */ }
    }
  };
}
