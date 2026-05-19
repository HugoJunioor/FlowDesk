/**
 * Testes de integração das rotas de notas com supertest.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { notaService } from '../nota.service';
import { authService } from '@modules/auth/auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { NotFoundError } from '@shared/domain/errors';
import type { Nota } from '../nota.dto';

jest.mock('../nota.service', () => ({
  notaService: {
    listMine: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    toggleChecklistItem: jest.fn(),
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

jest.mock('@modules/telegram/telegram.service', () => ({
  telegramService: { startLink: jest.fn(), cancelLink: jest.fn(), disconnect: jest.fn(), getStatus: jest.fn(), processWebhookUpdate: jest.fn(), sendNotification: jest.fn() },
}));

const notaMock = notaService as jest.Mocked<typeof notaService>;
const authMock = authService as jest.Mocked<typeof authService>;

const fakeNota = (overrides: Partial<Nota> = {}): Nota => ({
  id: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'usuario@flowdesk.local',
  titulo: 'Nota Teste',
  conteudo: '',
  status: 'todo',
  tags: [],
  cor: null,
  ordem: 1,
  items: [],
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  ...overrides,
});

function setupAuth(role: 'master' | 'user' = 'user') {
  const ctx = createAuthenticatedUser({ role });
  authMock.getMe.mockResolvedValue(ctx.user);
  return ctx;
}

const app = createTestApp();

describe('GET /api/v1/notas', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retorna lista do user autenticado', async () => {
    const { authHeader } = setupAuth();
    notaMock.listMine.mockResolvedValue([fakeNota()]);

    const res = await request(app)
      .get('/api/v1/notas')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toHaveLength(1);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/notas');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/notas/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retorna nota por id', async () => {
    const { authHeader } = setupAuth();
    notaMock.findOne.mockResolvedValue(fakeNota());

    const res = await request(app)
      .get('/api/v1/notas/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.dados.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('404 quando nota não existe', async () => {
    const { authHeader } = setupAuth();
    notaMock.findOne.mockRejectedValue(
      new NotFoundError('Nota', '00000000-0000-4000-8000-000000000099'),
    );

    const res = await request(app)
      .get('/api/v1/notas/00000000-0000-4000-8000-000000000099')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('400 quando id não é UUID', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .get('/api/v1/notas/nao-e-uuid')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/notas/00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/notas', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 cria nota com body válido', async () => {
    const { authHeader } = setupAuth();
    notaMock.create.mockResolvedValue(fakeNota({ titulo: 'Nova Nota' }));

    const res = await request(app)
      .post('/api/v1/notas')
      .set('Authorization', authHeader)
      .send({ titulo: 'Nova Nota' });

    expect(res.status).toBe(201);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.titulo).toBe('Nova Nota');
  });

  it('400 quando titulo ausente', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .post('/api/v1/notas')
      .set('Authorization', authHeader)
      .send({ conteudo: 'sem titulo' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/v1/notas')
      .send({ titulo: 'X' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/notas/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 atualiza nota', async () => {
    const { authHeader } = setupAuth();
    notaMock.update.mockResolvedValue(fakeNota({ titulo: 'Atualizado' }));

    const res = await request(app)
      .patch('/api/v1/notas/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader)
      .send({ titulo: 'Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.dados.titulo).toBe('Atualizado');
  });

  it('404 nota não encontrada', async () => {
    const { authHeader } = setupAuth();
    notaMock.update.mockRejectedValue(
      new NotFoundError('Nota', '00000000-0000-4000-8000-000000000099'),
    );

    const res = await request(app)
      .patch('/api/v1/notas/00000000-0000-4000-8000-000000000099')
      .set('Authorization', authHeader)
      .send({ titulo: 'X' });

    expect(res.status).toBe(404);
  });

  it('400 id inválido', async () => {
    const { authHeader } = setupAuth();

    const res = await request(app)
      .patch('/api/v1/notas/nao-uuid')
      .set('Authorization', authHeader)
      .send({ titulo: 'X' });

    expect(res.status).toBe(400);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .patch('/api/v1/notas/00000000-0000-4000-8000-000000000001')
      .send({ titulo: 'X' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/notas/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('204 remove nota', async () => {
    const { authHeader } = setupAuth();
    notaMock.remove.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/notas/00000000-0000-4000-8000-000000000001')
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
  });

  it('404 nota não encontrada', async () => {
    const { authHeader } = setupAuth();
    notaMock.remove.mockRejectedValue(
      new NotFoundError('Nota', '00000000-0000-4000-8000-000000000099'),
    );

    const res = await request(app)
      .delete('/api/v1/notas/00000000-0000-4000-8000-000000000099')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).delete('/api/v1/notas/00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(401);
  });
});
