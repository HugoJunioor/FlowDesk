/**
 * Testes do telegramService.
 *
 * Estratégia:
 * - Mocks de pool e telegramClient para isolar completamente
 * - Testa o fluxo de linking (geração de code, webhook, cancel, disconnect)
 * - Testa getStatus
 */
import { pool } from '@config/database';
import { telegramClient } from '../telegram.client';
import { telegramService } from '../telegram.service';
import { NotFoundError } from '@shared/domain/errors';

jest.mock('@config/database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../telegram.client', () => ({
  telegramClient: { sendMessage: jest.fn() },
  escapeMarkdownV2: (s: string) => s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1'),
}));

const poolMock = pool as jest.Mocked<typeof pool>;
const clientMock = telegramClient as jest.Mocked<typeof telegramClient>;

const FAKE_USER = {
  id: 'uuid-1',
  email: 'hugo@just.com.br',
  nome: 'Operador',
  telegram_chat_id: null,
  telegram_connected_at: null,
};

describe('telegramService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startLink', () => {
    it('gera code e retorna linkStartResponse', async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [FAKE_USER] } as never);

      const result = await telegramService.startLink('hugo@just.com.br');

      expect(result.code).toMatch(/^[A-F0-9]{8}$/);
      expect(result.botUsername).toBeDefined();
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('lança NotFoundError se usuário não existe', async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

      await expect(telegramService.startLink('ninguem@just.com.br')).rejects.toThrow(NotFoundError);
    });

    it('remove code anterior do mesmo user antes de gerar novo', async () => {
      poolMock.query.mockResolvedValue({ rows: [FAKE_USER] } as never);

      const r1 = await telegramService.startLink('hugo@just.com.br');
      const r2 = await telegramService.startLink('hugo@just.com.br');

      // Novo code é diferente (com probabilidade esmagadora)
      // O código antigo não deve mais estar ativo
      expect(r1.code).not.toBe(r2.code);
    });
  });

  describe('cancelLink', () => {
    it('cancela sem erro se não há code pendente', () => {
      expect(() => telegramService.cancelLink('hugo@just.com.br')).not.toThrow();
    });

    it('cancela code pendente existente', async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [FAKE_USER] } as never);
      await telegramService.startLink('hugo@just.com.br');
      // Não deve lançar
      telegramService.cancelLink('hugo@just.com.br');
    });
  });

  describe('disconnect', () => {
    it('executa UPDATE limpando telegram_chat_id', async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await telegramService.disconnect('hugo@just.com.br');

      expect(poolMock.query).toHaveBeenCalledWith(
        expect.stringContaining('telegram_chat_id = NULL'),
        ['hugo@just.com.br'],
      );
    });
  });

  describe('getStatus', () => {
    it('retorna connected=false quando chat_id é null', async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [FAKE_USER] } as never);

      const status = await telegramService.getStatus('hugo@just.com.br');
      expect(status.connected).toBe(false);
      expect(status.chatId).toBeUndefined();
    });

    it('retorna connected=true com chatId quando conectado', async () => {
      const connectedAt = new Date();
      poolMock.query.mockResolvedValueOnce({
        rows: [{ ...FAKE_USER, telegram_chat_id: '12345', telegram_connected_at: connectedAt }],
      } as never);

      const status = await telegramService.getStatus('hugo@just.com.br');
      expect(status.connected).toBe(true);
      expect(status.chatId).toBe('12345');
      expect(status.connectedAt).toBe(connectedAt.toISOString());
    });

    it('lança NotFoundError se usuário não existe', async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [] } as never);
      await expect(telegramService.getStatus('x@just.com.br')).rejects.toThrow(NotFoundError);
    });
  });

  describe('processWebhookUpdate', () => {
    it('ignora updates sem texto', async () => {
      await telegramService.processWebhookUpdate({ update_id: 1 });
      expect(clientMock.sendMessage).not.toHaveBeenCalled();
    });

    it('ignora mensagens sem pattern /start CODE', async () => {
      await telegramService.processWebhookUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 1, first_name: 'Operador' },
          chat: { id: 999, type: 'private' },
          date: Date.now(),
          text: '/help',
        },
      });
      expect(clientMock.sendMessage).not.toHaveBeenCalled();
    });

    it('responde com erro quando code inválido', async () => {
      clientMock.sendMessage.mockResolvedValueOnce(undefined);

      await telegramService.processWebhookUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 1, first_name: 'Operador' },
          chat: { id: 999, type: 'private' },
          date: Date.now(),
          text: '/start FFFFFFFF',
        },
      });

      expect(clientMock.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ chat_id: 999 }),
      );
    });

    it('vincula chat_id ao usuário com code válido', async () => {
      // Setup: gera um code válido
      poolMock.query.mockResolvedValueOnce({ rows: [FAKE_USER] } as never); // startLink
      const { code } = await telegramService.startLink('hugo@just.com.br');

      poolMock.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // UPDATE
      clientMock.sendMessage.mockResolvedValueOnce(undefined);

      await telegramService.processWebhookUpdate({
        update_id: 2,
        message: {
          message_id: 2,
          from: { id: 77, first_name: 'Operador' },
          chat: { id: 77, type: 'private' },
          date: Date.now(),
          text: `/start ${code}`,
        },
      });

      expect(poolMock.query).toHaveBeenCalledWith(
        expect.stringContaining('telegram_chat_id = $1'),
        ['77', FAKE_USER.id],
      );
      expect(clientMock.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ chat_id: 77, parse_mode: 'MarkdownV2' }),
      );
    });
  });
});
