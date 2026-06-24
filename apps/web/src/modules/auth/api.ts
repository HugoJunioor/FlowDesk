/**
 * Funções HTTP dos módulos Auth e Usuarios — chamam a API via apiClient.
 *
 * Padrão Just: cada módulo tem `api.ts` que isola os endpoints. Os
 * hooks (em `hooks.ts`) consomem essas funções via React Query.
 */
import { apiClient, setAccessToken } from '@/lib/api/client';
import { unwrap } from '@/lib/api/response-mapper';
import type { AuthResponse, AuthenticatedUser } from './types';
import type { UserThemePreferences } from '@/types/auth';

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

// ── Tipos espelhando a API ────────────────────────────────────────────────────

export type { UserThemePreferences as UsuarioThemePreferences };

export interface UsuarioApi {
  id: string;
  login: string;
  email: string;
  nome: string;
  perfil: 'master' | 'user';
  status: 'active' | 'blocked';
  primeiroAcesso: boolean;
  resetSenhaSolicitado: boolean;
  themePreferences: UsuarioThemePreferences | null;
  language: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface UpdateMyPreferencesPayload {
  themePreferences?: UsuarioThemePreferences | null;
  language?: string | null;
}

export interface CreateUsuarioPayload {
  nome: string;
  email: string;
  perfil: 'master' | 'user';
}

export interface UpdateUsuarioPayload {
  nome?: string;
  perfil?: 'master' | 'user';
  status?: 'active' | 'blocked';
}

export const usuariosApi = {
  async list(): Promise<UsuarioApi[]> {
    const res = await apiClient.get<{ sucesso: true; dados: UsuarioApi[] }>('/usuarios');
    return unwrap(res);
  },

  async create(payload: CreateUsuarioPayload): Promise<{ usuario: UsuarioApi; senhaTempOraria: string }> {
    const res = await apiClient.post<{ sucesso: true; dados: { usuario: UsuarioApi; senhaTempOraria: string } }>(
      '/usuarios',
      payload,
    );
    return unwrap(res);
  },

  async update(id: string, payload: UpdateUsuarioPayload): Promise<UsuarioApi> {
    const res = await apiClient.put<{ sucesso: true; dados: UsuarioApi }>(`/usuarios/${id}`, payload);
    return unwrap(res);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/usuarios/${id}`);
  },

  async resetPassword(id: string): Promise<{ senhaTempOraria: string }> {
    const res = await apiClient.post<{ sucesso: true; dados: { senhaTempOraria: string } }>(
      `/usuarios/${id}/reset-password`,
      {},
    );
    return unwrap(res);
  },

  async updateMyPreferences(payload: UpdateMyPreferencesPayload): Promise<UsuarioApi> {
    const res = await apiClient.patch<{ sucesso: true; dados: UsuarioApi }>(
      '/usuarios/me/preferences',
      payload,
    );
    return unwrap(res);
  },
};
