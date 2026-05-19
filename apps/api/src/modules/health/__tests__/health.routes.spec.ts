/**
 * Testes das rotas de health check.
 */
import request from 'supertest';
import { createTestApp } from '../../../__tests__/helpers/app';

jest.mock('@config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
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

jest.mock('@modules/telegram/telegram.service', () => ({
  telegramService: { startLink: jest.fn(), cancelLink: jest.fn(), disconnect: jest.fn(), getStatus: jest.fn(), processWebhookUpdate: jest.fn(), sendNotification: jest.fn() },
}));

import { pool } from '@config/database';

const poolMock = pool as jest.Mocked<typeof pool>;
const connectMock = pool.connect as jest.Mock;

const app = createTestApp();

describe('GET /health', () => {
  it('200 retorna status ok com versão e uptime', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe('ok');
    expect(res.body.dados.version).toBeDefined();
    expect(typeof res.body.dados.uptimeSeconds).toBe('number');
    expect(res.body.dados.startedAt).toBeDefined();
  });
});

describe('GET /health/detailed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('200 com status ok quando DB responde', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: jest.fn(),
    };
    connectMock.mockResolvedValue(client);

    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.checks.database).toBeDefined();
    expect(res.body.dados.checks.memory).toBeDefined();
    expect(res.body.dados.checks.disk).toBeDefined();
    expect(typeof res.body.dados.checks.database.latencyMs).toBe('number');
  });

  it('200 com status degraded quando DB falha', async () => {
    const client = {
      query: jest.fn().mockRejectedValue(new Error('Connection refused')),
      release: jest.fn(),
    };
    connectMock.mockResolvedValue(client);

    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(200);
    expect(res.body.dados.status).toBe('degraded');
    expect(res.body.dados.checks.database.ok).toBe(false);
    expect(res.body.dados.checks.database.error).toBe('Connection refused');
  });

  it('200 quando connect falha (pool sem conexão)', async () => {
    connectMock.mockRejectedValue(new Error('Pool exhausted'));

    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(200);
    expect(res.body.dados.checks.database.ok).toBe(false);
  });

  it('body contém versão e uptime', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    connectMock.mockResolvedValue(client);

    const res = await request(app).get('/health/detailed');

    expect(res.body.dados.version).toBeDefined();
    expect(typeof res.body.dados.uptime).toBe('number');
  });
});
