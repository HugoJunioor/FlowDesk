/**
 * Testes de integração das rotas de demanda com supertest.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { demandaService } from '../demanda.service';
import { authService } from '@modules/auth/auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { NotFoundError, ForbiddenError } from '@shared/domain/errors';
import type { Demanda } from '../demanda.dto';

jest.mock('../demanda.service', () => ({
  demandaService: {
    list: jest.fn(),
    findById: jest.fn(),
    createInfra: jest.fn(),
    update: jest.fn(),
    atender: jest.fn(),
    concluir: jest.fn(),
    remove: jest.fn(),
  },
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

const demandaMock = demandaService as jest.Mocked<typeof demandaService>;
const authMock = authService as jest.Mocked<typeof authService>;

const fakeDemanda = (overrides: Partial<Demanda> = {}): Demanda => ({
  id: '00000000-0000-4000-8000-000000000001',
  origem: 'internal',
  titulo: 'Demanda teste',
  descricao: null,
  prioridade: 'p3',
  status: 'aberta',
  tipoDemanda: null,
  workflow: null,
  produto: null,
  solicitanteNome: 'Test User',
  solicitanteAvatar: null,
  responsavelNome: 'Test User',
  responsavelAvatar: null,
  infraKind: 'sql',
  infraQuery: null,
  infraDatabase: null,
  infraExternalLink: null,
  canalSlack: null,
  permalinkSlack: null,
  replies: 0,
  dueDate: null,
  concluidaEm: null,
  serviceStartedAt: null,
  hasTask: false,
  taskLink: null,
  tags: [],
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  ...overrides,
});

function setupAuth(role: 'master' | 'user' = 'user') {
  const ctx = createAuthenticatedUser({ role });
  authMock.getMe.mockResolvedValue(ctx.user);
  return ctx;
}

describe('GET /api/v1/demandas', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 happy path com paginação', async () => {
    const { authHeader } = setupAuth();
    demandaMock.list.mockResolvedValue({
      dados: [fakeDemanda()],
      total: 1,
      pagina: 1,
      limite: 50,
      totalPaginas: 1,
    });

    const res = await request(app)
      .get('/api/v1/demandas')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toHaveLength(1);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/demandas');
    expect(res.status).toBe(401);
  });

  it('400 quando query inválida (limite > 100)', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .get('/api/v1/demandas?limite=999')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });
});

describe('GET /api/v1/demandas/:id', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 quando demanda existe', async () => {
    const { authHeader } = setupAuth();
    demandaMock.findById.mockResolvedValue(fakeDemanda());

    const res = await request(app)
      .get('/api/v1/demandas/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.dados.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('404 quando não existe', async () => {
    const { authHeader } = setupAuth();
    demandaMock.findById.mockRejectedValue(
      new NotFoundError('Demanda', '00000000-0000-4000-8000-000000000099'),
    );

    const res = await request(app)
      .get('/api/v1/demandas/00000000-0000-4000-8000-000000000099')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('400 quando id não é UUID', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .get('/api/v1/demandas/nao-eh-uuid')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/demandas/00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/demandas/infra', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('201 com body válido', async () => {
    const { authHeader } = setupAuth();
    demandaMock.createInfra.mockResolvedValue(fakeDemanda());

    const res = await request(app)
      .post('/api/v1/demandas/infra')
      .set('Authorization', authHeader)
      .send({ titulo: 'Nova demanda', prioridade: 'p2', infraKind: 'sql', tags: [] });

    expect(res.status).toBe(201);
    expect(res.body.sucesso).toBe(true);
  });

  it('400 quando body inválido (sem titulo)', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .post('/api/v1/demandas/infra')
      .set('Authorization', authHeader)
      .send({ prioridade: 'p1', infraKind: 'sql' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/v1/demandas/infra')
      .send({ titulo: 'x', infraKind: 'sql' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/demandas/:id', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('204 quando master remove demanda', async () => {
    const { authHeader } = setupAuth('master');
    demandaMock.remove.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/demandas/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
  });

  it('403 quando user não master tenta remover', async () => {
    const { authHeader } = setupAuth('user');
    demandaMock.remove.mockRejectedValue(
      new ForbiddenError('Apenas o master pode excluir demandas'),
    );

    const res = await request(app)
      .delete('/api/v1/demandas/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .delete('/api/v1/demandas/00000000-0000-4000-8000-000000000001');

    expect(res.status).toBe(401);
  });
});
