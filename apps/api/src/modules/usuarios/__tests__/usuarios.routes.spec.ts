/**
 * Integration tests for usuarios routes via supertest.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { usuariosService } from '../usuarios.service';
import { authService } from '@modules/auth/auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { NotFoundError, ForbiddenError, ConflictError } from '@shared/domain/errors';

jest.mock('../usuarios.service', () => ({
  usuariosService: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    resetPassword: jest.fn(),
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
  telegramService: {
    startLink: jest.fn(),
    cancelLink: jest.fn(),
    disconnect: jest.fn(),
    getStatus: jest.fn(),
    processWebhookUpdate: jest.fn(),
    sendNotification: jest.fn(),
  },
}));

const serviceMock = usuariosService as jest.Mocked<typeof usuariosService>;
const authMock = authService as jest.Mocked<typeof authService>;

function setupAuth(role: 'master' | 'user' = 'master', id?: string) {
  const ctx = createAuthenticatedUser({ role, id });
  authMock.getMe.mockResolvedValue(ctx.user);
  return ctx;
}

const app = createTestApp();
const TARGET_ID = '00000000-0000-4000-8000-000000000099';

function fakePublicUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    login: 'maria.silva',
    email: 'maria@empresa.com',
    nome: 'Maria Silva',
    perfil: 'user' as const,
    status: 'active' as const,
    primeiroAcesso: false,
    avatarUrl: null,
    criadoEm: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/usuarios
// ---------------------------------------------------------------------------
describe('GET /api/v1/usuarios', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 returns paginated list for authenticated master', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.list.mockResolvedValue([fakePublicUser()]);

    const res = await request(app)
      .get('/api/v1/usuarios')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.dados)).toBe(true);
    expect(res.body.dados).toHaveLength(1);
    expect(res.body.dados[0].login).toBe('maria.silva');
  });

  it('401 without authentication', async () => {
    const res = await request(app).get('/api/v1/usuarios');
    expect(res.status).toBe(401);
  });

  it('403 when requester is not master', async () => {
    const { authHeader } = setupAuth('user');
    const res = await request(app)
      .get('/api/v1/usuarios')
      .set('Authorization', authHeader);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/usuarios
// ---------------------------------------------------------------------------
describe('POST /api/v1/usuarios', () => {
  beforeEach(() => jest.clearAllMocks());

  const validBody = { nome: 'Maria Silva', email: 'maria@empresa.com', perfil: 'user' };

  it('201 creates user and returns temp password', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.create.mockResolvedValue({
      usuario: fakePublicUser(),
      senhaTempOraria: 'TempP@ss1',
    });

    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.dados.usuario).toBeDefined();
    expect(res.body.dados.senhaTempOraria).toBe('TempP@ss1');
  });

  it('409 when email is already registered', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.create.mockRejectedValue(new ConflictError('E-mail já cadastrado'));

    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(409);
  });

  it('403 when requester is not master', async () => {
    const { authHeader } = setupAuth('user');

    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('400 when body is invalid', async () => {
    const { authHeader } = setupAuth('master');

    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', authHeader)
      .send({ nome: 'X' }); // missing email and perfil

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/usuarios/:id
// ---------------------------------------------------------------------------
describe('PUT /api/v1/usuarios/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 updates user successfully', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.update.mockResolvedValue(fakePublicUser({ nome: 'Maria Editada' }));

    const res = await request(app)
      .put(`/api/v1/usuarios/${TARGET_ID}`)
      .set('Authorization', authHeader)
      .send({ nome: 'Maria Editada' });

    expect(res.status).toBe(200);
    expect(res.body.dados.nome).toBe('Maria Editada');
  });

  it('403 when master tries to self-block or self-demote', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.update.mockRejectedValue(
      new ForbiddenError('Não é permitido alterar a própria role ou bloquear a própria conta'),
    );

    const res = await request(app)
      .put(`/api/v1/usuarios/${TARGET_ID}`)
      .set('Authorization', authHeader)
      .send({ status: 'blocked' });

    expect(res.status).toBe(403);
  });

  it('400 when id is not a valid UUID', async () => {
    const { authHeader } = setupAuth('master');

    const res = await request(app)
      .put('/api/v1/usuarios/not-a-uuid')
      .set('Authorization', authHeader)
      .send({ nome: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/usuarios/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/v1/usuarios/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('204 deletes user successfully', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.delete.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/v1/usuarios/${TARGET_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
  });

  it('403 when trying to delete a master account', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.delete.mockRejectedValue(
      new ForbiddenError('Não é permitido excluir conta master'),
    );

    const res = await request(app)
      .delete(`/api/v1/usuarios/${TARGET_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('404 when user does not exist', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.delete.mockRejectedValue(new NotFoundError('Usuário não encontrado'));

    const res = await request(app)
      .delete(`/api/v1/usuarios/${TARGET_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/usuarios/:id/reset-password
// ---------------------------------------------------------------------------
describe('POST /api/v1/usuarios/:id/reset-password', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 resets password and returns temp password', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.resetPassword.mockResolvedValue({ senhaTempOraria: 'ResetP@ss9' });

    const res = await request(app)
      .post(`/api/v1/usuarios/${TARGET_ID}/reset-password`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.dados.senhaTempOraria).toBe('ResetP@ss9');
  });

  it('404 when user does not exist', async () => {
    const { authHeader } = setupAuth('master');
    serviceMock.resetPassword.mockRejectedValue(new NotFoundError('Usuário não encontrado'));

    const res = await request(app)
      .post(`/api/v1/usuarios/${TARGET_ID}/reset-password`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('400 when id is not a valid UUID', async () => {
    const { authHeader } = setupAuth('master');

    const res = await request(app)
      .post('/api/v1/usuarios/not-a-uuid/reset-password')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/usuarios/:id/lgpd (existing coverage kept)
// ---------------------------------------------------------------------------
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
