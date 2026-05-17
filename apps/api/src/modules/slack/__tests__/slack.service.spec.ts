/**
 * Testes unitários do slackService.
 *
 * Mocka o pool de banco — não toca em DB real.
 */
import { slackService } from '../slack.service';

// Mock do pool antes de importar o service
jest.mock('@config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock do logger para não poluir output dos testes
jest.mock('@shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

import { pool } from '@config/database';

const poolMock = pool as jest.Mocked<typeof pool>;

describe('slackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── url_verification ────────────────────────────────────────────────────

  describe('handleUrlVerification', () => {
    it('retorna o challenge recebido', () => {
      const result = slackService.handleUrlVerification({
        type: 'url_verification',
        challenge: 'abc123',
      });
      expect(result).toEqual({ challenge: 'abc123' });
    });
  });

  // ── handleEvent: event_callback com message ─────────────────────────────

  describe('handleEvent — message novo em canal cliente', () => {
    it('insere demanda quando evento é bot message com keyword em canal cliente-*', async () => {
      poolMock.query.mockResolvedValue({ rows: [], rowCount: 1 } as never);

      const result = await slackService.handleEvent({
        type: 'event_callback',
        event_id: 'Ev001',
        event_time: 1700000000,
        event: {
          type: 'message',
          subtype: 'bot_message',
          channel: 'C12345',
          channel_name: 'cliente-acme',
          text: 'Nova demanda recebida: problema no sistema',
          ts: '1700000000.000100',
          bot_id: 'B123',
        },
      });

      expect(result.deduplicated).toBe(false);
      expect(poolMock.query).toHaveBeenCalledTimes(1);

      const [sql, params] = (poolMock.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO tb_demanda');
      expect(params[2]).toBe('cliente-acme'); // canal_slack
    });

    it('nao insere demanda quando canal nao começa com cliente-', async () => {
      poolMock.query.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      await slackService.handleEvent({
        type: 'event_callback',
        event_id: 'Ev002',
        event_time: 1700000001,
        event: {
          type: 'message',
          subtype: 'bot_message',
          channel: 'C99999',
          channel_name: 'geral',
          text: 'Nova demanda recebida: teste',
          ts: '1700000001.000100',
          bot_id: 'B123',
        },
      });

      expect(poolMock.query).not.toHaveBeenCalled();
    });
  });

  // ── handleEvent: reaction_added ─────────────────────────────────────────

  describe('handleEvent — reaction_added large_green_circle', () => {
    it('atualiza status para concluida', async () => {
      poolMock.query.mockResolvedValue({ rows: [{ id: 'uuid-1' }], rowCount: 1 } as never);

      const result = await slackService.handleEvent({
        type: 'event_callback',
        event_id: 'Ev003',
        event_time: 1700000002,
        event: {
          type: 'reaction_added',
          user: 'U123',
          reaction: 'large_green_circle',
          item: { type: 'message', channel: 'C12345', ts: '1700000000.000100' },
          event_ts: '1700000002.000100',
        },
      });

      expect(result.deduplicated).toBe(false);
      expect(poolMock.query).toHaveBeenCalledTimes(1);
      const [sql] = (poolMock.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status = 'concluida'");
    });

    it('ignora reaction que nao e de conclusao', async () => {
      await slackService.handleEvent({
        type: 'event_callback',
        event_id: 'Ev004',
        event_time: 1700000003,
        event: {
          type: 'reaction_added',
          user: 'U123',
          reaction: 'thumbsup',
          item: { type: 'message', channel: 'C12345', ts: '1700000000.000100' },
          event_ts: '1700000003.000100',
        },
      });

      expect(poolMock.query).not.toHaveBeenCalled();
    });
  });

  // ── handleEvent: reaction_removed ───────────────────────────────────────

  describe('handleEvent — reaction_removed white_check_mark', () => {
    it('reabre demanda concluida', async () => {
      poolMock.query.mockResolvedValue({ rows: [{ id: 'uuid-1' }], rowCount: 1 } as never);

      await slackService.handleEvent({
        type: 'event_callback',
        event_id: 'Ev005',
        event_time: 1700000004,
        event: {
          type: 'reaction_removed',
          user: 'U123',
          reaction: 'white_check_mark',
          item: { type: 'message', channel: 'C12345', ts: '1700000000.000100' },
          event_ts: '1700000004.000100',
        },
      });

      expect(poolMock.query).toHaveBeenCalledTimes(1);
      const [sql] = (poolMock.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status = 'aberta'");
    });
  });

  // ── Deduplicacao ─────────────────────────────────────────────────────────

  describe('deduplicacao por event_id', () => {
    it('ignora evento com mesmo event_id na segunda chamada', async () => {
      poolMock.query.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const payload = {
        type: 'event_callback' as const,
        event_id: 'Ev_DEDUP_TEST_WT',
        event_time: 1700000010,
        event: {
          type: 'reaction_added',
          user: 'U123',
          reaction: 'large_green_circle',
          item: { type: 'message', channel: 'C12345', ts: '1700000010.000100' },
          event_ts: '1700000010.000100',
        },
      };

      const first = await slackService.handleEvent(payload);
      const second = await slackService.handleEvent(payload);

      expect(first.deduplicated).toBe(false);
      expect(second.deduplicated).toBe(true);
      // Pool só chamado uma vez (na primeira)
      expect(poolMock.query).toHaveBeenCalledTimes(1);
    });
  });
});
