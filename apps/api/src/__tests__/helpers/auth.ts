/**
 * Helper compartilhado para testes que precisam de usuário autenticado.
 *
 * Cria um JWT assinado com JWT_SECRET do setup de testes e retorna o user
 * no formato AuthenticatedUser. Evita boilerplate em testes de rota.
 */
import jwt from 'jsonwebtoken';

export interface FakeUser {
  id: string;
  login: string;
  email: string;
  nome: string;
  perfil: 'master' | 'user';
  status: 'active' | 'blocked';
  primeiroAcesso: boolean;
  grupos: string[];
  permissoes: Array<{ modulo: string; acao: string }>;
}

export interface AuthContext {
  token: string;
  user: FakeUser;
  authHeader: string;
}

const TEST_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret-test';

export function createAuthenticatedUser(overrides: {
  role?: 'master' | 'user';
  email?: string;
  nome?: string;
  id?: string;
  permissoes?: Array<{ modulo: string; acao: string }>;
} = {}): AuthContext {
  const role = overrides.role ?? 'user';
  const user: FakeUser = {
    id: overrides.id ?? 'user-test-id-00000000000000001',
    login: role === 'master' ? 'master' : 'usuario',
    email: overrides.email ?? (role === 'master' ? 'master@flowdesk.local' : 'usuario@flowdesk.local'),
    nome: overrides.nome ?? (role === 'master' ? 'Admin Master' : 'Usuario Teste'),
    perfil: role,
    status: 'active',
    primeiroAcesso: false,
    grupos: [],
    permissoes: overrides.permissoes ?? [],
  };

  const token = jwt.sign(
    { sub: user.id, login: user.login, perfil: user.perfil },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: 3600 },
  );

  return {
    token,
    user,
    authHeader: `Bearer ${token}`,
  };
}
