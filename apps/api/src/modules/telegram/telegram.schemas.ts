/**
 * Schemas Zod do módulo Telegram.
 *
 * - Payloads do webhook (Bot API Update)
 * - Respostas dos endpoints autenticados
 */
import { z } from 'zod';

// ── Webhook (Bot API) ────────────────────────────────────────────────────────

export const telegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

export const telegramChatSchema = z.object({
  id: z.number(),
  type: z.string(),
  first_name: z.string().optional(),
  username: z.string().optional(),
});

export const telegramMessageSchema = z.object({
  message_id: z.number(),
  from: telegramUserSchema.optional(),
  chat: telegramChatSchema,
  date: z.number(),
  text: z.string().optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
export type TelegramMessage = z.infer<typeof telegramMessageSchema>;

// ── Endpoints autenticados ───────────────────────────────────────────────────

export interface LinkStartResponse {
  code: string;
  expiresAt: string; // ISO 8601
  botUsername: string;
}

export interface TelegramStatusResponse {
  connected: boolean;
  chatId?: string;
  connectedAt?: string; // ISO 8601
}
