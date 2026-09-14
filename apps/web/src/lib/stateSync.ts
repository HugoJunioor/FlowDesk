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

/**
 * Teto para a busca inicial de estado. Sem ele o app nao renderiza nunca se o
 * legacy-state travar: main.tsx so monta a arvore no .finally() do
 * initStateSync(), entao um fetch pendurado e tela branca permanente — nem o
 * formulario de login aparece.
 */
const INIT_FETCH_TIMEOUT_MS = 8_000;

let initialized = false;
let authToken: string | null = null;

/**
 * Enquanto true, o interceptor de localStorage nao envia nada ao servidor.
 *
 * initStateSync() escreve as 8 chaves sincronizadas ao aplicar o que veio do
 * servidor. Com o interceptor ativo, cada uma dessas escritas disparava um PUT
 * de volta — ou seja, todo carregamento de pagina reenviava ao servidor
 * exatamente o que tinha acabado de baixar dele, incluindo os ~700 KB de
 * fd_demand_overrides. Como o legacy-state grava com writeFileSync sincrono e
 * o servidor e HTTP/1.1 (6 conexoes por origem), essa rajada enfileirava as
 * requisicoes seguintes — inclusive o POST de login.
 */
let suppressInterceptor = false;

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
    // Mesmo teto do fetch de estado: esta chamada tambem e aguardada antes do
    // primeiro render, entao pendurar aqui trava o app do mesmo jeito.
    const res = await fetch("/__token", {
      method: "GET",
      credentials: "include",
      signal: AbortSignal.timeout(INIT_FETCH_TIMEOUT_MS),
    });
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
      signal: AbortSignal.timeout(INIT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const serverState = (await res.json()) as Partial<Record<SyncedKey, unknown>>;

    // A partir daqui so escrevemos localmente o que ja veio do servidor —
    // devolver isso em PUT seria puro trabalho repetido. Ver suppressInterceptor.
    suppressInterceptor = true;

    // Keys that are ID-indexed dictionaries — merge server + local so entries
    // written by any browser (past or present) are preserved. Blindly copying
    // server → local here would silently drop overrides that were made offline
    // or before the PR that started pushing them (see PR #187).
    const MERGEABLE_DICT_KEYS: Set<string> = new Set(["fd_demand_overrides", "fd_sql_demand_overrides"]);

    for (const key of SYNCED_KEYS) {
      const serverValue = serverState[key];
      const localRaw = localStorage.getItem(key);

      if (MERGEABLE_DICT_KEYS.has(key)) {
        // Merge dictionaries. Local wins on conflict (the user's browser has
        // the freshest edit that likely hasn't been pushed yet).
        const serverDict = (serverValue && typeof serverValue === "object") ? (serverValue as Record<string, unknown>) : {};
        let localDict: Record<string, unknown> = {};
        try { localDict = localRaw ? (JSON.parse(localRaw) as Record<string, unknown>) : {}; }
        catch { localDict = {}; }
        const merged = { ...serverDict, ...localDict };
        localStorage.setItem(key, JSON.stringify(merged));
        // If merge introduced entries missing on the server, push them up.
        const serverKeys = Object.keys(serverDict);
        const mergedKeys = Object.keys(merged);
        if (mergedKeys.length > serverKeys.length) {
          try { await pushToServer(key, merged); } catch { /* ignore */ }
        }
        continue;
      }

      if (serverValue !== undefined && serverValue !== null) {
        localStorage.setItem(key, JSON.stringify(serverValue));
      } else if (localRaw) {
        try {
          await pushToServer(key, JSON.parse(localRaw));
        } catch { /* ignore */ }
      }
    }
    console.log("[stateSync] Estado sincronizado com servidor");
  } catch (err) {
    // AbortError aqui e o timeout acima: o app segue com o localStorage que ja
    // tem, em vez de ficar preso sem renderizar.
    console.warn("[stateSync] Servidor de estado indisponivel, usando localStorage:", err);
  } finally {
    suppressInterceptor = false;
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
    // Durante o initStateSync as escritas sao apenas a copia do que o servidor
    // acabou de mandar — devolve-las seria reenviar ~700 KB a cada boot.
    if (suppressInterceptor) return;
    if (this === window.localStorage && isSynced(key)) {
      try {
        void pushToServer(key as SyncedKey, JSON.parse(value));
      } catch { /* ignore non-JSON */ }
    }
  };
}
