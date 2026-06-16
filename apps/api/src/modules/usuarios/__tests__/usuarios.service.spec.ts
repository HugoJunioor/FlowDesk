/**
 * Unit tests for usuariosService — business guards for update, delete, and anonimizarLgpd.
 *
 * Repository and authRepository are mocked — no DB required.
 */
import { usuariosService } from '../usuarios.service';
import { usuariosRepository } from '../usuarios.repository';
import { authRepository } from '@modules/auth/auth.repository';
import { NotFoundError, ForbiddenError } from '@shared/domain/errors';

jest.mock('../usuarios.repository');
jest.mock('@modules/auth/auth.repository');

const repoMock = usuariosRepository as jest.Mocked<typeof usuariosRepository>;
const authRepoMock = authRepository as jest.Mocked<typeof authRepository>;

const MASTER_ID = 'master-id-000';
const TARGET_ID = 'target-id-111';

function fakeUsuario(overrides: Partial<{
  id: string;
  perfil: 'master' | 'user';
  status: 'active' | 'blocked';
  excluido_em: Date | null;
}> = {}): any {
  return {
    id: TARGET_ID,
    login: 'usuario.real',
    email: 'real@empresa.com',
    nome: 'Usuario Real',
    perfil: 'user',
    status: 'active',
    senha_hash: '$2b$12$fake',
    primeiro_acesso: false,
    reset_senha_solicitado: false,
    avatar_url: null,
    criado_em: new Date(),
    atualizado_em: new Date(),
    excluido_em: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// usuariosService.update
// ---------------------------------------------------------------------------
describe('usuariosService.update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates user successfully', async () => {
    const updated = fakeUsuario({ id: TARGET_ID });
    repoMock.findById.mockResolvedValue(fakeUsuario());
    repoMock.update.mockResolvedValue(updated);

    const result = await usuariosService.update(TARGET_ID, { nome: 'Novo Nome' }, MASTER_ID);

    expect(result).toBeDefined();
    expect(repoMock.update).toHaveBeenCalledWith(TARGET_ID, { nome: 'Novo Nome' });
  });

  it('throws ForbiddenError when master tries to block own account', async () => {
    repoMock.findById.mockResolvedValue(fakeUsuario({ id: MASTER_ID }));

    await expect(
      usuariosService.update(MASTER_ID, { status: 'blocked' }, MASTER_ID),
    ).rejects.toThrow(ForbiddenError);

    expect(repoMock.update).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when master tries to demote own account', async () => {
    repoMock.findById.mockResolvedValue(fakeUsuario({ id: MASTER_ID, perfil: 'master' }));

    await expect(
      usuariosService.update(MASTER_ID, { perfil: 'user' }, MASTER_ID),
    ).rejects.toThrow(ForbiddenError);

    expect(repoMock.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when user does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(
      usuariosService.update(TARGET_ID, { nome: 'X' }, MASTER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when user is soft-deleted', async () => {
    repoMock.findById.mockResolvedValue(fakeUsuario({ excluido_em: new Date() }));

    await expect(
      usuariosService.update(TARGET_ID, { nome: 'X' }, MASTER_ID),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// usuariosService.delete
// ---------------------------------------------------------------------------
describe('usuariosService.delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authRepoMock.revokeAllUserRefreshTokens.mockResolvedValue(undefined);
  });

  it('soft-deletes user successfully', async () => {
    repoMock.findById.mockResolvedValue(fakeUsuario({ perfil: 'user' }));
    repoMock.softDelete.mockResolvedValue(fakeUsuario());

    await expect(
      usuariosService.delete(TARGET_ID, MASTER_ID),
    ).resolves.toBeUndefined();

    expect(repoMock.softDelete).toHaveBeenCalledWith(TARGET_ID);
  });

  it('throws ForbiddenError when trying to delete own account', async () => {
    await expect(
      usuariosService.delete(MASTER_ID, MASTER_ID),
    ).rejects.toThrow(ForbiddenError);

    expect(repoMock.findById).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when target is a master account', async () => {
    repoMock.findById.mockResolvedValue(fakeUsuario({ perfil: 'master' }));

    await expect(
      usuariosService.delete(TARGET_ID, MASTER_ID),
    ).rejects.toThrow(ForbiddenError);

    expect(repoMock.softDelete).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when user does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(
      usuariosService.delete(TARGET_ID, MASTER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it('revokes refresh tokens before soft-deleting', async () => {
    repoMock.findById.mockResolvedValue(fakeUsuario({ perfil: 'user' }));
    repoMock.softDelete.mockResolvedValue(fakeUsuario());

    await usuariosService.delete(TARGET_ID, MASTER_ID);

    expect(authRepoMock.revokeAllUserRefreshTokens).toHaveBeenCalledWith(
      TARGET_ID,
      'usuario_excluido',
    );
  });
});

// ---------------------------------------------------------------------------
// usuariosService.anonimizarLgpd
// ---------------------------------------------------------------------------
describe('usuariosService.anonimizarLgpd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authRepoMock.revokeAllUserRefreshTokens.mockResolvedValue(undefined);
  });

  it('anonimiza com sucesso e retorna id + anonimizadoEm', async () => {
    const agora = new Date();
    repoMock.findById.mockResolvedValue(fakeUsuario());
    repoMock.anonimizar.mockResolvedValue({ id: TARGET_ID, anonimizadoEm: agora });

    const resultado = await usuariosService.anonimizarLgpd(TARGET_ID, MASTER_ID);

    expect(resultado.id).toBe(TARGET_ID);
    expect(resultado.anonimizadoEm).toBe(agora);
  });

  it('revoga refresh tokens antes de anonimizar', async () => {
    const agora = new Date();
    repoMock.findById.mockResolvedValue(fakeUsuario());
    repoMock.anonimizar.mockResolvedValue({ id: TARGET_ID, anonimizadoEm: agora });

    await usuariosService.anonimizarLgpd(TARGET_ID, MASTER_ID);

    expect(authRepoMock.revokeAllUserRefreshTokens).toHaveBeenCalledWith(
      TARGET_ID,
      'anonimize_lgpd',
    );
  });

  it('passa email no formato anonimo-{uuid}@deleted.local', async () => {
    const agora = new Date();
    repoMock.findById.mockResolvedValue(fakeUsuario());
    repoMock.anonimizar.mockResolvedValue({ id: TARGET_ID, anonimizadoEm: agora });

    await usuariosService.anonimizarLgpd(TARGET_ID, MASTER_ID);

    const chamada = repoMock.anonimizar.mock.calls[0];
    expect(chamada?.[1].email).toMatch(/^anonimo-[0-9a-f-]{36}@deleted\.local$/);
    expect(chamada?.[1].nome).toBe('Usuário Anonimizado');
    expect(chamada?.[1].login).toMatch(/^anon_\d+$/);
    expect(chamada?.[1].senhaHash).toMatch(/^\$2[ab]\$/);
  });

  it('lança NotFoundError se usuário não existe', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(
      usuariosService.anonimizarLgpd(TARGET_ID, MASTER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it('lança ForbiddenError se master tenta anonimizar a própria conta', async () => {
    await expect(
      usuariosService.anonimizarLgpd(MASTER_ID, MASTER_ID),
    ).rejects.toThrow(ForbiddenError);
  });

  it('lança ForbiddenError se usuário já foi anonimizado (excluido_em preenchido)', async () => {
    repoMock.findById.mockResolvedValue(
      fakeUsuario({ excluido_em: new Date('2026-01-01') }),
    );

    await expect(
      usuariosService.anonimizarLgpd(TARGET_ID, MASTER_ID),
    ).rejects.toThrow(ForbiddenError);
  });

  it('não chama anonimizar se usuário não existe (sem side-effects)', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(
      usuariosService.anonimizarLgpd(TARGET_ID, MASTER_ID),
    ).rejects.toThrow(NotFoundError);

    expect(repoMock.anonimizar).not.toHaveBeenCalled();
    expect(authRepoMock.revokeAllUserRefreshTokens).not.toHaveBeenCalled();
  });
});
