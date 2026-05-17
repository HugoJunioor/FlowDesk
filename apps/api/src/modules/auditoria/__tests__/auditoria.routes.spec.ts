/**
 * Testes de integração das rotas de auditoria com supertest.
 *
 * Auditoria é restrita a master. Testamos autenticação, autorização
 * e happy path de listagem com filtros.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { auditoriaService } from '../auditoria.service';
import { authService } from '@modules/auth/auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { ForbiddenError } from '@shared/domain/errors';
import type { AuditoriaEntry } from '../auditoria.dto';

jest.mock('../auditoria.service', () => ({
  auditoriaService: {
    list: jest.fn(),
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

const auditMock = auditoriaService as jest.Mocked<typeof auditoriaService>;
const authMock = authService as jest.Mocked<typeof authService>;

const fakeEntry = (overrides: Partial<AuditoriaEntry> = {}): AuditoriaEntry => ({
  id: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'hugo@just.com.br',
  recurso: 'demanda',
  recursoId: 'dem-1',
  acao: 'create',
  payloadAntes: null,
  payloadDepois: { titulo: 'X' },
  ip: '127.0.0.1',
  userAgent: 'test',
  requestId: 'req-1',
  criadoEm: new Date(),
  ...overrides,
});

function setupAuthAs(role: 'master' | 'user') {
  const ctx = createAuthenticatedUser({ role });
  authMock.getMe.mockResolvedValue(ctx.user);
  return ctx;
}

describe('GET /api/v1/auditoria', () => {
  const app = createTestApp();
  beforeEach(() => jest.clearAllMocks());

  it('200 happy path para master', async () => {
    const { authHeader } = setupAuthAs('master');
    auditMock.list.mockResolvedValue({
      dados: [fakeEntry()],
      total: 1,
      pagina: 1,
      limite: 50,
      totalPaginas: 1,
    });

    const res = await request(app)
      .get('/api/v1/auditoria')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toHaveLength(1);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/auditoria');
    expect(res.status).toBe(401);
  });

  it('403 para usuário com perfil user (não master)', async () => {
    const { authHeader } = setupAuthAs('user');

    const res = await request(app)
      .get('/api/v1/auditoria')
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('400 quando query inválida (limite > 200)', async () => {
    const { authHeader } = setupAuthAs('master');

    const res = await request(app)
      .get('/api/v1/auditoria?limite=999')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACAO_FALHOU');
  });

  it('200 com filtros válidos (recurso, acao, usuarioEmail)', async () => {
    const { authHeader } = setupAuthAs('master');
    auditMock.list.mockResolvedValue({
      dados: [],
      total: 0,
      pagina: 1,
      limite: 50,
      totalPaginas: 1,
    });

    const res = await request(app)
      .get('/api/v1/auditoria?recurso=auth&acao=login&usuarioEmail=hugo%40just.com.br')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(auditMock.list).toHaveBeenCalledWith(expect.objectContaining({
      recurso: 'auth',
      acao: 'login',
      usuarioEmail: 'hugo@just.com.br',
    }));
  });
});
