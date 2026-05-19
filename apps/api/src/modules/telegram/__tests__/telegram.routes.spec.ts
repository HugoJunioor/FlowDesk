/**
 * Testes de integração das rotas do Telegram com supertest.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';
import { telegramService } from '../telegram.service';
import { authService } from '@modules/auth/auth.service';
import { createAuthenticatedUser } from '../../../__tests__/helpers/auth';
import { NotFoundError } from '@shared/domain/errors';

jest.mock('../telegram.service', () => ({
  telegramService: {
    startLink: jest.fn(),
    cancelLink: jest.fn(),
    disconnect: jest.fn(),
    getStatus: jest.fn(),
    processWebhookUpdate: jest.fn(),
    sendNotification: jest.fn(),
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

jest.mock('@config/env', () => ({
  env: {
    TELEGRAM_ENABLED: true,
    TELEGRAM_BOT_TOKEN: 'fake-token',
    TELEGRAM_WEBHOOK_SECRET: 'fake-secret',
    JWT_SECRET: 'test-secret-test-secret-test-secret-test',
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test',
    CORS_ORIGIN: '*',
    COOKIE_SECRET: 'test-cookie-secret',
  },
}));

const telegramMock = telegramService as jest.Mocked<typeof telegramService>;
const authMock = authService as jest.Mocked<typeof authService>;

function setupAuth(role: 'master' | 'user' = 'user') {
  const ctx = createAuthenticatedUser({ role });
  authMock.getMe.mockResolvedValue(ctx.user);
  return ctx;
}

const app = createTestApp();

describe('POST /api/v1/telegram/link/start', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retorna code de linking', async () => {
    const { authHeader } = setupAuth();
    telegramMock.startLink.mockResolvedValue({
      code: 'ABCD1234',
      botUsername: 'flowdesk_bot',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/telegram/link/start')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.code).toBe('ABCD1234');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).post('/api/v1/telegram/link/start');
    expect(res.status).toBe(401);
  });

  it('404 quando usuário não existe no sistema', async () => {
    const { authHeader } = setupAuth();
    telegramMock.startLink.mockRejectedValue(new NotFoundError('Usuário', 'x'));

    const res = await request(app)
      .post('/api/v1/telegram/link/start')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/telegram/link/cancel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 cancela code pendente', async () => {
    const { authHeader } = setupAuth();
    telegramMock.cancelLink.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/v1/telegram/link/cancel')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).post('/api/v1/telegram/link/cancel');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/telegram/link', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 desconecta Telegram', async () => {
    const { authHeader } = setupAuth();
    telegramMock.disconnect.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/telegram/link')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).delete('/api/v1/telegram/link');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/telegram/status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retorna status de conexão', async () => {
    const { authHeader } = setupAuth();
    telegramMock.getStatus.mockResolvedValue({ connected: false });

    const res = await request(app)
      .get('/api/v1/telegram/status')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.dados.connected).toBe(false);
  });

  it('200 retorna status conectado', async () => {
    const { authHeader } = setupAuth();
    telegramMock.getStatus.mockResolvedValue({
      connected: true,
      chatId: '12345',
      connectedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/api/v1/telegram/status')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.dados.connected).toBe(true);
    expect(res.body.dados.chatId).toBe('12345');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/telegram/status');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/telegram/webhook/:secret', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 quando secret válido', async () => {
    telegramMock.processWebhookUpdate.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/telegram/webhook/fake-secret')
      .send({ update_id: 1 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('403 quando secret inválido', async () => {
    const res = await request(app)
      .post('/api/v1/telegram/webhook/wrong-secret')
      .send({ update_id: 1 });

    expect(res.status).toBe(403);
  });

  it('200 quando body inválido (telegram não reenvia se 200)', async () => {
    const res = await request(app)
      .post('/api/v1/telegram/webhook/fake-secret')
      .send({ invalid: 'payload' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
