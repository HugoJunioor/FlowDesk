/**
 * Testes do telegramClient e escapeMarkdownV2.
 */
import { telegramClient, escapeMarkdownV2 } from '../telegram.client';

jest.mock('@config/env', () => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'fake-bot-token',
    TELEGRAM_ENABLED: true,
    TELEGRAM_WEBHOOK_SECRET: 'fake-secret',
  },
}));

jest.mock('@shared/logging/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// Mock global fetch
const fetchMock = jest.fn();
global.fetch = fetchMock;

describe('escapeMarkdownV2', () => {
  it('escapa underscore', () => {
    expect(escapeMarkdownV2('foo_bar')).toBe('foo\\_bar');
  });

  it('escapa asterisco', () => {
    expect(escapeMarkdownV2('**bold**')).toBe('\\*\\*bold\\*\\*');
  });

  it('escapa ponto e exclamação', () => {
    expect(escapeMarkdownV2('Hello. World!')).toBe('Hello\\. World\\!');
  });

  it('não modifica texto sem caracteres especiais', () => {
    expect(escapeMarkdownV2('texto simples')).toBe('texto simples');
  });

  it('escapa todos os caracteres especiais do MarkdownV2', () => {
    const special = '_*[]()~`>#+-.=|{}.!\\';
    const result = escapeMarkdownV2(special);
    // Cada caractere especial deve estar precedido por \
    expect(result).toMatch(/^\\/);
    expect(result.length).toBeGreaterThan(special.length);
  });
});

describe('telegramClient.sendMessage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('chama a API do Telegram com parâmetros corretos', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ ok: true, result: {} }),
    });

    await telegramClient.sendMessage({
      chat_id: 12345,
      text: 'Olá',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"chat_id":12345'),
      }),
    );
  });

  it('lança erro quando API retorna ok=false', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ ok: false, description: 'Bad Request' }),
    });

    await expect(
      telegramClient.sendMessage({ chat_id: 99, text: 'teste' }),
    ).rejects.toThrow('Telegram API error [sendMessage]: Bad Request');
  });

  it('lança erro quando fetch falha com erro de rede', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      telegramClient.sendMessage({ chat_id: 99, text: 'teste' }),
    ).rejects.toThrow('Network error');
  });
});
