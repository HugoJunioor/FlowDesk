/**
 * Sincroniza chaves do localStorage com um arquivo compartilhado no servidor.
 *
 * Problema que resolve: localStorage e por origem (localhost vs 192.x.x.x),
 * entao usuarios cadastrados, overrides, grupos e regras ficam isolados por
 * dispositivo. Este modulo centraliza esses dados em um arquivo servido pelo
 * Vite, permitindo que todos os acessos (VPN inclusa) convirjam no mesmo estado.
 *
 * Fluxo:
 *  - Ao iniciar, puxa estado do servidor e sobrescreve localStorage
 *  - Ao salvar (via setSyncedItem), salva em localStorage E envia pro servidor
 *  - Se o servidor estiver offline, continua funcionando so com localStorage
 */

const SYNCED_KEYS = [
  "fd_users_v2",
  "fd_demand_overrides",
  "fd_sql_demand_overrides",
  "fd_groups",
  "fd_group_permissions",
  "fd_auto_assign_rules",
  "fd_support_members",
] as const;

type SyncedKey = typeof SYNCED_KEYS[number];

const ENDPOINT = "/__state";

let initialized = false;

/** Busca estado do servidor e sobrescreve chaves locais. Chamar no startup. */
export async function initStateSync(): Promise<void> {
  if (initialized) return;
  try {
    const res = await fetch(ENDPOINT, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const serverState = (await res.json()) as Partial<Record<SyncedKey, unknown>>;

    for (const key of SYNCED_KEYS) {
      const value = serverState[key];
      if (value !== undefined && value !== null) {
        // Servidor tem dados: sobrescreve localStorage
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        // Servidor nao tem dados: enviar o que esta no localStorage (primeira vez)
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch (err) {
    console.warn(`[stateSync] Falha ao enviar "${key}" ao servidor:`, err);
  }
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
