/**
 * Testes de integração das rotas de usuários com supertest.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { usuariosService } from '../usuarios.service';
import { authService } from '@modules/auth/auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { NotFoundError, ForbiddenError } from '@shared/domain/errors';

jest.mock('../usuarios.service', () => ({
  usuariosService: {
    anonimizarLgpd: jest.fn(),
  },
  _internals: {},
}));

jest.mock('@modules/auth/auth.service', () => ({
  authService: {
    getMe: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
  },
  _internals: { resetLockouts: jest.fn() },
}));

jest.mock('@config/database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('@shared/audit/audit.service', () => ({
  auditService: { log: jest.fn() },
}));

jest.mock('@modules/telegram/telegram.service', () => ({
  telegramService: { startLink: jest.fn(), cancelLink: jest.fn(), disconnect: jest.fn(), getStatus: jest.fn(), processWebhookUpdate: jest.fn(), sendNotification: jest.fn() },
}));

const serviceMock = usuariosService as jest.Mocked<typeof usuariosService>;
const authMock = authService as jest.Mocked<typeof authService>;

function setupAuth(role: 'master' | 'user' = 'master') {
  const ctx = createAuthenticatedUser({ role });
  authMock.getMe.mockResolvedValue(ctx.user);
  return ctx;
}

const app = createTestApp();
const TARGET_ID = '00000000-0000-4000-8000-000000000099';

describe('DELETE /api/v1/usuarios/:id/lgpd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 anonimiza com sucesso (master)', async () => {
    const { authHeader } = setupAuth('master');
    const agora = new Date();
    serviceMock.anonimizarLgpd.mockResolvedValue({ id: TARGET_ID, anonimizadoEm: agora });

    const res = await request(app)
      .delete(`/api/v1/usuarios/${TARGET_ID}/lgpd`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.id).toBe(TARGET_ID);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).delete(`/api/v1/usuarios/${TARGET_ID}/lgpd`);
    expect(res.status).toBe(401);
  });

  it('403 quando perfil é user (não master)', async () => {
    const { authHeader } = setupAuth('user');

    const res = await request(app)
      .delete(`/api/v1/usuarios/${TARGET_ID}/lgpd`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('400 quando id não é UUID válido', async () => {
    const { authHeader } = setupAuth('master');

    const res = await request(app)
      .delete('/api/v1/usuarios/nao-e-uuid/lgpd')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('404 quando usuário não existe', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.anonimizarLgpd.mockRejectedValue(new NotFoundError('Usuário não encontrado'));

    const res = await request(app)
      .delete(`/api/v1/usuarios/${TARGET_ID}/lgpd`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('403 quando tenta anonimizar a própria conta', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.anonimizarLgpd.mockRejectedValue(
      new ForbiddenError('Não é permitido anonimizar a própria conta'),
    );

    const res = await request(app)
      .delete(`/api/v1/usuarios/${TARGET_ID}/lgpd`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });
});
