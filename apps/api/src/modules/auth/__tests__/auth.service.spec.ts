/**
 * Testes do auth.service.
 *
 * Mockamos o repository — testes unitários sem banco.
 */
import bcrypt from 'bcryptjs';
import { authService, _internals } from '../auth.service';
import { authRepository } from '../auth.repository';
import { UnauthorizedError, ForbiddenError, ValidationError } from '@shared/domain/errors';

jest.mock('../auth.repository');

const repoMock = authRepository as jest.Mocked<typeof authRepository>;

function fakeUser(overrides: Partial<{
  id: string; login: string; status: string; primeiro_acesso: boolean; senha_hash: string;
}> = {}): any {
  return {
    id: 'user-id-1',
    login: 'master',
    email: 'admin@flowdesk.local',
    nome: 'Admin',
    perfil: 'master',
    status: 'active',
    senha_hash: '',
    primeiro_acesso: false,
    reset_senha_solicitado: false,
    avatar_url: null,
    criado_em: new Date(),
    atualizado_em: new Date(),
    excluido_em: null,
    ...overrides,
  };
}

describe('authService.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _internals.resetLockouts();
    repoMock.listUserGroups.mockResolvedValue([]);
    repoMock.listUserPermissions.mockResolvedValue([]);
    repoMock.createRefreshToken.mockResolvedValue(undefined);
  });

  it('login válido retorna accessToken + refreshToken', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    repoMock.findUserByLogin.mockResolvedValue(fakeUser({ senha_hash: senhaHash }));

    const result = await authService.login({ login: 'master', senha: 'senha-correta' });

    expect(result.auth.accessToken).toBeTruthy();
    expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.auth.usuario.login).toBe('master');
    expect(repoMock.createRefreshToken).toHaveBeenCalled();
  });

  it('senha errada retorna UnauthorizedError', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    repoMock.findUserByLogin.mockResolvedValue(fakeUser({ senha_hash: senhaHash }));

    await expect(
      authService.login({ login: 'master', senha: 'errada' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('user inexistente retorna UnauthorizedError', async () => {
    repoMock.findUserByLogin.mockResolvedValue(null);

    await expect(
      authService.login({ login: 'fantasma', senha: 'x' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('user blocked retorna ForbiddenError', async () => {
    repoMock.findUserByLogin.mockResolvedValue(fakeUser({ status: 'blocked' }));

    await expect(
      authService.login({ login: 'master', senha: 'x' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('5 tentativas falhas geram lockout (6a tentativa é bloqueada)', async () => {
    const senhaHash = await bcrypt.hash('correta', 4);
    repoMock.findUserByLogin.mockResolvedValue(fakeUser({ senha_hash: senhaHash }));

    for (let i = 0; i < 5; i++) {
      await expect(
        authService.login({ login: 'master', senha: 'errada' }),
      ).rejects.toThrow(UnauthorizedError);
    }
    // 6a tentativa: lockout
    await expect(
      authService.login({ login: 'master', senha: 'errada' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('login bem sucedido limpa contador de lockout', async () => {
    const senhaHash = await bcrypt.hash('correta', 4);
    repoMock.findUserByLogin.mockResolvedValue(fakeUser({ senha_hash: senhaHash }));

    // 2 tentativas falhas
    await expect(
      authService.login({ login: 'master', senha: 'errada' }),
    ).rejects.toThrow(UnauthorizedError);
    await expect(
      authService.login({ login: 'master', senha: 'errada' }),
    ).rejects.toThrow(UnauthorizedError);

    // Login certo: deve funcionar
    const result = await authService.login({ login: 'master', senha: 'correta' });
    expect(result.auth.accessToken).toBeTruthy();
  });
});

describe('authService.refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repoMock.listUserGroups.mockResolvedValue([]);
    repoMock.listUserPermissions.mockResolvedValue([]);
    repoMock.revokeRefreshToken.mockResolvedValue(undefined);
    repoMock.createRefreshToken.mockResolvedValue(undefined);
  });

  it('refresh válido gera novo par de tokens (rotação)', async () => {
    repoMock.findRefreshTokenByHash.mockResolvedValue({
      id: 't1',
      usuario_id: 'user-id-1',
      token_hash: 'hash',
      expira_em: new Date(Date.now() + 86400000),
      revogado_em: null,
      motivo_revogacao: null,
      user_agent_resumo: null,
      ip: null,
      criado_em: new Date(),
      ultimo_uso_em: null,
    });
    repoMock.findUserById.mockResolvedValue(fakeUser());

    const result = await authService.refresh('any-token-string');

    expect(result.auth.accessToken).toBeTruthy();
    expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(repoMock.revokeRefreshToken).toHaveBeenCalledWith(expect.any(String), 'rotacionado');
    expect(repoMock.createRefreshToken).toHaveBeenCalled();
  });

  it('refresh ausente -> UnauthorizedError', async () => {
    await expect(authService.refresh('')).rejects.toThrow(UnauthorizedError);
  });

  it('refresh revogado -> UnauthorizedError', async () => {
    repoMock.findRefreshTokenByHash.mockResolvedValue({
      id: 't1',
      usuario_id: 'u',
      token_hash: 'h',
      expira_em: new Date(Date.now() + 86400000),
      revogado_em: new Date(),
      motivo_revogacao: 'logout',
      user_agent_resumo: null,
      ip: null,
      criado_em: new Date(),
      ultimo_uso_em: null,
    });

    await expect(authService.refresh('x')).rejects.toThrow(UnauthorizedError);
  });

  it('refresh expirado -> UnauthorizedError', async () => {
    repoMock.findRefreshTokenByHash.mockResolvedValue({
      id: 't1',
      usuario_id: 'u',
      token_hash: 'h',
      expira_em: new Date(Date.now() - 1000),
      revogado_em: null,
      motivo_revogacao: null,
      user_agent_resumo: null,
      ip: null,
      criado_em: new Date(),
      ultimo_uso_em: null,
    });

    await expect(authService.refresh('x')).rejects.toThrow(UnauthorizedError);
  });
});

describe('authService.changePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repoMock.updatePassword.mockResolvedValue(undefined);
    repoMock.revokeAllUserRefreshTokens.mockResolvedValue(undefined);
  });

  it('troca de senha funciona com senha atual correta', async () => {
    const senhaHash = await bcrypt.hash('atual-123', 4);
    repoMock.findUserById.mockResolvedValue(fakeUser({ senha_hash: senhaHash }));

    await authService.changePassword('user-id-1', {
      senhaAtual: 'atual-123',
      novaSenha: 'NovaSenha@123',
    });

    expect(repoMock.updatePassword).toHaveBeenCalled();
    expect(repoMock.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-id-1', 'mudanca_senha');
  });

  it('senha atual errada -> UnauthorizedError', async () => {
    const senhaHash = await bcrypt.hash('atual', 4);
    repoMock.findUserById.mockResolvedValue(fakeUser({ senha_hash: senhaHash }));

    await expect(
      authService.changePassword('user-id-1', { senhaAtual: 'errada', novaSenha: 'X' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('nova senha igual à atual -> ValidationError', async () => {
    const senhaHash = await bcrypt.hash('mesma-senha', 4);
    repoMock.findUserById.mockResolvedValue(fakeUser({ senha_hash: senhaHash }));

    await expect(
      authService.changePassword('user-id-1', { senhaAtual: 'mesma-senha', novaSenha: 'mesma-senha' }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('_internals.ttlToSeconds', () => {
  it('converte unidades comuns', () => {
    expect(_internals.ttlToSeconds('30s')).toBe(30);
    expect(_internals.ttlToSeconds('15m')).toBe(900);
    expect(_internals.ttlToSeconds('2h')).toBe(7200);
    expect(_internals.ttlToSeconds('7d')).toBe(604800);
    expect(_internals.ttlToSeconds('120')).toBe(120);
  });
});
