/**
 * Cliente HTTP central da app — axios singleton.
 *
 * Padrao Just:
 * - Base URL configuravel via VITE_API_URL
 * - Access token em memoria (Context). Refresh em HttpOnly cookie
 *   (browser anexa automaticamente)
 * - Interceptor 401: tenta /auth/refresh; se falhar, dispara logout
 *
 * NUNCA armazena tokens em localStorage — vulneravel a XSS.
 */
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Token em modulo-level — substitui localStorage. Reseta no F5
// (refresh cookie regenera no boot do app).
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Listeners pra logout disparado pelo interceptor (quando refresh falha).
type LogoutListener = () => void;
const logoutListeners = new Set<LogoutListener>();
export function onForcedLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);
  return () => logoutListeners.delete(listener);
}
function fireForcedLogout(): void {
  for (const l of logoutListeners) {
    try { l(); } catch { /* ignore */ }
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // permite cookie HttpOnly do refresh
  timeout: 30_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) {
    config.headers.set?.('Authorization', `Bearer ${accessToken}`);
    // fallback pra versoes que nao tem set()
    if (!config.headers.get?.('Authorization')) {
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    }
  }
  return config;
});

// Refresh dedupe — varias requests simultaneas em 401 disparariam varios refresh
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await axios.post<{ sucesso: boolean; dados: { accessToken: string } }>(
        `${BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken = res.data?.dados?.accessToken ?? null;
      if (newToken) setAccessToken(newToken);
      return newToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthRoute = config?.url?.includes('/auth/login') ||
                        config?.url?.includes('/auth/refresh') ||
                        config?.url?.includes('/auth/logout');
    if (error.response?.status === 401 && config && !config._retry && !isAuthRoute) {
      config._retry = true;
      const newToken = await tryRefresh();
      if (newToken) {
        if (config.headers) {
          config.headers.set?.('Authorization', `Bearer ${newToken}`);
        }
        return apiClient(config);
      }
      // Refresh falhou — dispara logout forcado
      setAccessToken(null);
      fireForcedLogout();
    }
    return Promise.reject(error);
  },
);

/**
 * Erro estruturado equivalente ao envelope da API. Use em catches que
 * precisam reagir por codigo (ex: RATE_LIMIT, VALIDACAO_FALHOU).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string,
    public detalhes?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { erro?: boolean; mensagem?: string; codigo?: string; detalhes?: unknown }
      | undefined;
    return new ApiError(
      data?.mensagem || err.message,
      err.response?.status ?? 0,
      data?.codigo,
      data?.detalhes,
    );
  }
  return new ApiError(err instanceof Error ? err.message : String(err), 0);
}
