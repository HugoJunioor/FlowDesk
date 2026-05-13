/**
 * Funções HTTP do módulo Auth — chamam a API via apiClient.
 *
 * Padrão Just: cada módulo tem `api.ts` que isola os endpoints. Os
 * hooks (em `hooks.ts`) consomem essas funções via React Query.
 */
import { apiClient, setAccessToken } from '@/lib/api/client';
import { unwrap } from '@/lib/api/response-mapper';
import type { AuthResponse, AuthenticatedUser } from './types';

interface LoginPayload {
  login: string;
  senha: string;
}

interface ChangePasswordPayload {
  senhaAtual: string;
  novaSenha: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await apiClient.post<{ sucesso: true; dados: AuthResponse }>('/auth/login', payload);
    const dados = unwrap(res);
    setAccessToken(dados.accessToken);
    return dados;
  },

  async refresh(): Promise<AuthResponse> {
    const res = await apiClient.post<{ sucesso: true; dados: AuthResponse }>('/auth/refresh', {});
    const dados = unwrap(res);
    setAccessToken(dados.accessToken);
    return dados;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      setAccessToken(null);
    }
  },

  async me(): Promise<AuthenticatedUser> {
    const res = await apiClient.get<{ sucesso: true; dados: AuthenticatedUser }>('/auth/me');
    return unwrap(res);
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiClient.post('/auth/change-password', payload);
  },
};
