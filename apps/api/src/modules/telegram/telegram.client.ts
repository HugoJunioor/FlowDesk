/**
 * Wrapper HTTP sobre a Bot API do Telegram.
 *
 * Apenas os métodos necessários para o FlowDesk. Usa fetch nativo
 * (Node 18+) — sem dependência extra.
 */
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';

const BASE = 'https://api.telegram.org';

function botUrl(method: string): string {
  return `${BASE}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

interface SendMessageParams {
  chat_id: string | number;
  text: string;
  parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown';
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function post<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(botUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as TelegramApiResponse<T>;

  if (!data.ok) {
    throw new Error(`Telegram API error [${method}]: ${data.description ?? 'unknown'}`);
  }

  return data.result as T;
}

export const telegramClient = {
  async sendMessage(params: SendMessageParams): Promise<void> {
    try {
      await post('sendMessage', params as unknown as Record<string, unknown>);
    } catch (err) {
      logger.warn({ err, chat_id: params.chat_id }, 'telegram: falha ao enviar mensagem');
      throw err;
    }
  },
};

/**
 * Escapa texto para MarkdownV2.
 * Ref: https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
