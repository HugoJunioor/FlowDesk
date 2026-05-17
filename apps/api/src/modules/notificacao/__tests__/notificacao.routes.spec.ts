/**
 * Testes de integração das rotas de notificação com supertest.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { notificacaoService } from '../notificacao.service';
import { authService } from '@modules/auth/auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { NotFoundError } from '@shared/domain/errors';
import type { Notificacao } from '../notificacao.dto';

jest.mock('../notificacao.service', () => ({
  notificacaoService: {
    listMine: jest.fn(),
    create: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    getPreferencia: jest.fn(),
    savePreferencia: jest.fn(),
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

const notifMock = notificacaoService as jest.Mocked<typeof notificacaoService>;
const authMock = authService as jest.Mocked<typeof authService>;

const fakeNotif = (overrides: Partial<Notificacao> = {}): Notificacao => ({
  id: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'usuario@flowdesk.local',
  evento: 'demand_assigned',
  origem: 'infra',
  demandaId: null,
  titulo: 'Demanda atribuída',
  mensagem: null,
  ator: null,
  lida: false,
  lidaEm: null,
  enviadaPor: null,
  criadoEm: new Date(),
  ...overrides,
});

function setupAuth(role: 'master' | 'user' = 'user') {
  const ctx = createAuthenticatedUser({ role });
  authMock.getMe.mockResolvedValue(ctx.user);
  return ctx;
}

describe('GET /api/v1/notificacoes', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 retorna lista do user autenticado', async () => {
    const { authHeader } = setupAuth();
    notifMock.listMine.mockResolvedValue([fakeNotif()]);

    const res = await request(app)
      .get('/api/v1/notificacoes')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toHaveLength(1);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/notificacoes');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/notificacoes', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('201 com body válido', async () => {
    const { authHeader } = setupAuth();
    notifMock.create.mockResolvedValue(fakeNotif());

    const res = await request(app)
      .post('/api/v1/notificacoes')
      .set('Authorization', authHeader)
      .send({
        usuarioEmail: 'usuario@flowdesk.local',
        evento: 'demand_assigned',
        titulo: 'Nova demanda',
        origem: 'infra',
      });

    expect(res.status).toBe(201);
    expect(res.body.sucesso).toBe(true);
  });

  it('400 quando body inválido (sem titulo)', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .post('/api/v1/notificacoes')
      .set('Authorization', authHeader)
      .send({
        usuarioEmail: 'usuario@flowdesk.local',
        evento: 'demand_assigned',
      });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/v1/notificacoes')
      .send({ usuarioEmail: 'x@x.com', evento: 'demand_assigned', titulo: 'X' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/notificacoes/:id', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 marca como lida', async () => {
    const { authHeader } = setupAuth();
    notifMock.markRead.mockResolvedValue(fakeNotif({ lida: true }));

    const res = await request(app)
      .patch('/api/v1/notificacoes/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader)
      .send({ lida: true });

    expect(res.status).toBe(200);
    expect(res.body.dados.lida).toBe(true);
  });

  it('404 quando notificação não encontrada', async () => {
    const { authHeader } = setupAuth();
    notifMock.markRead.mockRejectedValue(
      new NotFoundError('Notificação', '00000000-0000-4000-8000-000000000099'),
    );

    const res = await request(app)
      .patch('/api/v1/notificacoes/00000000-0000-4000-8000-000000000099')
      .set('Authorization', authHeader)
      .send({ lida: true });

    expect(res.status).toBe(404);
  });

  it('400 quando body inválido (lida não é boolean)', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .patch('/api/v1/notificacoes/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader)
      .send({ lida: 'sim' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .patch('/api/v1/notificacoes/00000000-0000-4000-8000-000000000001')
      .send({ lida: true });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/notificacoes/mark-all-read', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 marca todas como lidas', async () => {
    const { authHeader } = setupAuth();
    notifMock.markAllRead.mockResolvedValue({ count: 5 });

    const res = await request(app)
      .post('/api/v1/notificacoes/mark-all-read')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.dados.count).toBe(5);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).post('/api/v1/notificacoes/mark-all-read');
    expect(res.status).toBe(401);
  });
});
