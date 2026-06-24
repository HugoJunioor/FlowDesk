/**
 * DTOs do módulo Auth.
 *
 * Schemas Zod + types derivados. Validados pelo middleware antes do
 * controller.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Login obrigatório').max(100),
  senha: z.string().min(1, 'Senha obrigatória').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual obrigatória'),
  novaSenha: z.string().min(10, 'Nova senha precisa ter pelo menos 10 caracteres').max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Resposta de login/refresh — token de acesso + dados básicos do user. */
export interface AuthResponse {
  accessToken: string;
  /** Tempo de expiração do access em segundos. */
  expiresIn: number;
  usuario: AuthenticatedUser;
}

export interface ThemePreferences {
  mode: 'light' | 'dark';
  colorTheme: string;
}

/** User retornado no contexto autenticado (sem senha hash). */
export interface AuthenticatedUser {
  id: string;
  login: string;
  email: string;
  nome: string;
  perfil: 'master' | 'user';
  status: 'active' | 'blocked';
  primeiroAcesso: boolean;
  grupos: string[];
  permissoes: Array<{ modulo: string; acao: string }>;
  themePreferences: ThemePreferences | null;
  language: string | null;
}
