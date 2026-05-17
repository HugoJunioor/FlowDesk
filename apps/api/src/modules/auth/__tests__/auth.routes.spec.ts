/**
 * Testes de integração das rotas de auth com supertest.
 *
 * Mockamos authService (service) para não depender de banco.
 * O middleware authenticate chama authService.getMe — mockado aqui.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { authService } from '../auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { UnauthorizedError } from '@shared/domain/errors';

jest.mock('../auth.service', () => ({
  authService: {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
    changePassword: jest.fn(),
  },
  _internals: {
    resetLockouts: jest.fn(),
  },
}));

jest.mock('@config/database', () => ({
  pool: { query: jest.fn() },
}));

const serviceMock = authService as jest.Mocked<typeof authService>;

function fakeAuthResult(overrides: { perfil?: 'master' | 'user' } = {}) {
  const perfil = overrides.perfil ?? 'user';
  return {
    auth: {
      accessToken: 'fake-access-token',
      expiresIn: 900,
      usuario: {
        id: 'user-1',
        login: 'test',
        email: 'test@flowdesk.local',
        nome: 'Test User',
        perfil,
        status: 'active' as const,
        primeiroAcesso: false,
        grupos: [],
        permissoes: [],
      },
    },
    refreshToken: 'fake-refresh-token',
    refreshExpiresAt: new Date(Date.now() + 86400000),
  };
}

function fakeGetMe(overrides: { perfil?: 'master' | 'user' } = {}) {
  const perfil = overrides.perfil ?? 'user';
  return {
    id: 'user-1',
    login: 'test',
    email: 'test@flowdesk.local',
    nome: 'Test User',
    perfil,
    status: 'active' as const,
    primeiroAcesso: false,
    grupos: [],
    permissoes: [],
  };
}

describe('POST /api/v1/auth/login', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 com credenciais válidas', async () => {
    serviceMock.login.mockResolvedValue(fakeAuthResult());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'test', senha: 'senha-valida' });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.accessToken).toBeTruthy();
  });

  it('400 quando body inválido (sem login)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ senha: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('400 quando body vazio', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('401 quando credenciais erradas', async () => {
    serviceMock.login.mockRejectedValue(new UnauthorizedError('Inválido'));

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'test', senha: 'errada' });

    expect(res.status).toBe(401);
    expect(res.body.erro).toBe(true);
  });
});

describe('GET /api/v1/auth/me', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 com token válido', async () => {
    const { authHeader } = createAuthenticatedUser({ role: 'user' });
    serviceMock.getMe.mockResolvedValue(fakeGetMe());

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it('401 sem token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 com token malformado', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 mesmo sem cookie', async () => {
    serviceMock.logout.mockResolvedValue(undefined);
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });
});

describe('POST /api/v1/auth/change-password', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ senhaAtual: 'atual', novaSenha: 'nova-senha-123' });

    expect(res.status).toBe(401);
  });

  it('400 quando body inválido (nova senha curta)', async () => {
    const { authHeader } = createAuthenticatedUser({ role: 'user' });
    serviceMock.getMe.mockResolvedValue(fakeGetMe());

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', authHeader)
      .send({ senhaAtual: 'atual', novaSenha: 'curta' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('200 com dados válidos', async () => {
    const { authHeader } = createAuthenticatedUser({ role: 'user' });
    serviceMock.getMe.mockResolvedValue(fakeGetMe());
    serviceMock.changePassword.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', authHeader)
      .send({ senhaAtual: 'atual-123', novaSenha: 'nova-senha-forte-123' });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });
});
