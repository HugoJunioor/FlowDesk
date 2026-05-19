/**
 * Service do módulo Telegram.
 *
 * Responsabilidades:
 *   - Gerenciar linking_codes em memória (TTL 10 min)
 *   - Processar webhook do Bot (valida code, persiste chat_id)
 *   - Retornar status de conexão
 *   - Enviar mensagens (usado pelo notificacao.service)
 */
import crypto from 'node:crypto';
import { pool } from '@config/database';
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';
import { NotFoundError } from '@shared/domain/errors';
import { telegramClient, escapeMarkdownV2 } from './telegram.client';
import type { TelegramUpdate, LinkStartResponse, TelegramStatusResponse } from './telegram.schemas';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min

interface PendingLink {
  userId: string;
  userEmail: string;
  userName: string;
  expiresAt: Date;
}

// Armazenamento em memória por processo — suficiente para o fluxo de linking.
// Em caso de multi-instância, usar Redis. TTL gerenciado por expiresAt.
const pendingLinks = new Map<string, PendingLink>();

function generateCode(): string {
  // 8 chars hex uppercase — legível, suficientemente único para TTL curto
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function cleanExpired(): void {
  const now = Date.now();
  for (const [code, entry] of pendingLinks) {
    if (entry.expiresAt.getTime() < now) {
      pendingLinks.delete(code);
    }
  }
}

interface UsuarioRow {
  id: string;
  email: string;
  nome: string;
  telegram_chat_id: string | null;
  telegram_connected_at: Date | null;
}

async function findUserByEmail(email: string): Promise<UsuarioRow | null> {
  const res = await pool.query<UsuarioRow>(
    `SELECT id, email, nome, telegram_chat_id, telegram_connected_at
     FROM tb_usuario
     WHERE email = $1 AND excluido_em IS NULL`,
    [email],
  );
  return res.rows[0] ?? null;
}

export const telegramService = {
  /**
   * Gera um linking code para o usuário e retorna as instruções.
   */
  async startLink(userEmail: string): Promise<LinkStartResponse> {
    cleanExpired();

    // Remove code anterior do mesmo user se existir
    for (const [code, entry] of pendingLinks) {
      if (entry.userEmail === userEmail) {
        pendingLinks.delete(code);
      }
    }

    const user = await findUserByEmail(userEmail);
    if (!user) throw new NotFoundError('Usuário', userEmail);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    pendingLinks.set(code, {
      userId: user.id,
      userEmail: user.email,
      userName: user.nome,
      expiresAt,
    });

    logger.info({ userId: user.id, code }, 'telegram: linking code gerado');

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      botUsername: env.TELEGRAM_BOT_USERNAME,
    };
  },

  /**
   * Cancela o código pendente do usuário (se houver).
   */
  cancelLink(userEmail: string): void {
    for (const [code, entry] of pendingLinks) {
      if (entry.userEmail === userEmail) {
        pendingLinks.delete(code);
        logger.info({ userEmail, code }, 'telegram: linking code cancelado');
        return;
      }
    }
  },

  /**
   * Desconecta o Telegram do usuário (set chat_id = null).
   */
  async disconnect(userEmail: string): Promise<void> {
    await pool.query(
      `UPDATE tb_usuario
       SET telegram_chat_id = NULL, telegram_connected_at = NULL
       WHERE email = $1`,
      [userEmail],
    );
    logger.info({ userEmail }, 'telegram: usuario desconectado');
  },

  /**
   * Retorna o status de conexão do usuário.
   */
  async getStatus(userEmail: string): Promise<TelegramStatusResponse> {
    const user = await findUserByEmail(userEmail);
    if (!user) throw new NotFoundError('Usuário', userEmail);

    if (!user.telegram_chat_id) {
      return { connected: false };
    }

    return {
      connected: true,
      chatId: user.telegram_chat_id,
      connectedAt: user.telegram_connected_at?.toISOString(),
    };
  },

  /**
   * Processa um Update recebido do webhook do Telegram.
   * Extrai o command /start <CODE> e vincula o chat ao usuário.
   */
  async processWebhookUpdate(update: TelegramUpdate): Promise<void> {
    cleanExpired();

    const message = update.message;
    if (!message?.text || !message.from) return;

    const text = message.text.trim();
    // Aceita "/start CODE" ou "/start@BotName CODE"
    const match = /^\/start(?:@\S+)?\s+([A-F0-9]{8})$/i.exec(text);
    if (!match) return;

    const code = match[1]!.toUpperCase();
    const entry = pendingLinks.get(code);

    if (!entry) {
      logger.warn({ code, chat_id: message.chat.id }, 'telegram: code inválido ou expirado');
      await telegramClient.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Código inválido ou expirado\\. Gere um novo código no FlowDesk\\.',
        parse_mode: 'MarkdownV2',
      });
      return;
    }

    if (entry.expiresAt.getTime() < Date.now()) {
      pendingLinks.delete(code);
      await telegramClient.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Código expirado\\. Gere um novo no FlowDesk\\.',
        parse_mode: 'MarkdownV2',
      });
      return;
    }

    const chatId = String(message.chat.id);

    await pool.query(
      `UPDATE tb_usuario
       SET telegram_chat_id = $1, telegram_connected_at = NOW()
       WHERE id = $2`,
      [chatId, entry.userId],
    );

    pendingLinks.delete(code);

    logger.info({ userId: entry.userId, chatId }, 'telegram: usuario conectado com sucesso');

    const nomeEscapado = escapeMarkdownV2(entry.userName);
    await telegramClient.sendMessage({
      chat_id: message.chat.id,
      text: `✅ *FlowDesk conectado para ${nomeEscapado}\\!*\n\nVocê receberá notificações por aqui\\.`,
      parse_mode: 'MarkdownV2',
    });
  },

  /**
   * Envia uma notificação via Telegram para o chat_id informado.
   * Fire-and-forget — erros são logados mas não propagados.
   */
  async sendNotification(params: {
    chatId: string;
    titulo: string;
    cliente: string;
    prioridade: number;
    sla: string;
    demandaId: string;
  }): Promise<void> {
    const { chatId, titulo, cliente, prioridade, sla, demandaId } = params;

    const text = [
      '🔔 *Nova demanda atribuída*',
      '',
      `*Título:* ${escapeMarkdownV2(titulo)}`,
      `*Cliente:* ${escapeMarkdownV2(cliente)}`,
      `*Prioridade:* P${prioridade}`,
      `*SLA:* ${escapeMarkdownV2(sla)}`,
      '',
      `Acesse: https://flowdesk\\.empresa\\.com/demandas?openId=${escapeMarkdownV2(demandaId)}`,
    ].join('\n');

    await telegramClient.sendMessage({ chat_id: chatId, text, parse_mode: 'MarkdownV2' });
  },
};
