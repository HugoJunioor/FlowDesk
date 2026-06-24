/**
 * Types do módulo Auth — espelham os DTOs da api/src/modules/auth/auth.dto.ts.
 *
 * Mantemos cópia local em vez de importar diretamente porque api e web
 * são workspaces separados. Quando criarmos @flowdesk/shared-types
 * podemos derivar daqui.
 */

export type { UserThemePreferences } from '@/types/auth';

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
  themePreferences: UserThemePreferences | null;
  language: string | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  usuario: AuthenticatedUser;
}
