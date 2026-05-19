/**
 * Service de notificações.
 *
 * Regras:
 *   - Lista é sempre do user logado (segurança server-side, não
 *     confia no client passar email)
 *   - PATCH e markAllRead validam ownership
 *   - Cap de 500 mais recentes por user (FIFO automático via prune)
 */
import { NotFoundError, ForbiddenError } from '@shared/domain/errors';
import { logger } from '@shared/logging/logger';
import { env } from '@config/env';
import { pool } from '@config/database';
import { telegramService } from '@modules/telegram/telegram.service';
import { notificacaoRepository } from './notificacao.repository';
import type {
  CreateNotificacaoInput,
  Notificacao,
  Preferencia,
  PreferenciaInput,
} from './notificacao.dto';

const MAX_PER_USER = 500;

const DEFAULT_PREFS: Omit<Preferencia, 'usuarioEmail'> = {
  eventos: {
    demand_assigned: true,
    demand_replied: true,
    demand_started: true,
    demand_completed: true,
    demand_reopened: true,
    demand_overdue: true,
    demand_due_soon: true,
    demand_created: false,
  },
  canais: { inbox: true, browserPush: false, email: false, telegram: true },
  slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
  dailyReminder: true,
};

export const notificacaoService = {
  async listMine(userEmail: string): Promise<Notificacao[]> {
    return notificacaoRepository.listByUser(userEmail, MAX_PER_USER);
  },

  async create(input: CreateNotificacaoInput): Promise<Notificacao> {
    const created = await notificacaoRepository.create(input);
    // Mantem FIFO de 500 — apaga as mais antigas se ultrapassar
    void notificacaoRepository.pruneByUser(input.usuarioEmail, MAX_PER_USER);

    // Despacha via Telegram se habilitado e user tem chat_id (fire-and-forget)
    if (env.TELEGRAM_ENABLED) {
      void notificacaoService
        .dispatchTelegram(input)
        .catch((err) => logger.warn({ err }, 'notificacao: falha ao despachar via Telegram'));
    }

    return created;
  },

  async dispatchTelegram(input: CreateNotificacaoInput): Promise<void> {

    // Busca chat_id e preferências do user
    const [userRes, prefs] = await Promise.all([
      pool.query<{ telegram_chat_id: string | null }>(
        `SELECT telegram_chat_id FROM tb_usuario WHERE email = $1 AND excluido_em IS NULL`,
        [input.usuarioEmail],
      ),
      notificacaoService.getPreferencia(input.usuarioEmail),
    ]);

    const chatId = userRes.rows[0]?.telegram_chat_id;
    if (!chatId) return;
    if (!prefs.canais.telegram) return;

    await telegramService.sendNotification({
      chatId,
      titulo: input.titulo,
      cliente: input.ator ?? 'desconhecido',
      prioridade: 1, // sem prioridade no input atual — placeholder
      sla: 'ver no FlowDesk',
      demandaId: input.demandaId ?? '',
    });
  },

  async markRead(id: string, userEmail: string, lida: boolean): Promise<Notificacao> {
    // Busca primeiro pra validar ownership
    const all = await notificacaoRepository.listByUser(userEmail, MAX_PER_USER);
    const own = all.find((n) => n.id === id);
    if (!own) {
      // Não vaza informação: se não é dele, é como se não existisse
      throw new NotFoundError('Notificação', id);
    }
    const updated = await notificacaoRepository.markRead(id, lida);
    if (!updated) throw new NotFoundError('Notificação', id);
    if (updated.usuarioEmail.toLowerCase() !== userEmail.toLowerCase()) {
      // Defesa em profundidade — não deveria acontecer dado o check acima
      throw new ForbiddenError('Sem permissão');
    }
    return updated;
  },

  async markAllRead(userEmail: string): Promise<{ count: number }> {
    const count = await notificacaoRepository.markAllReadByUser(userEmail);
    return { count };
  },

  async getPreferencia(userEmail: string): Promise<Preferencia> {
    const stored = await notificacaoRepository.getPreferencia(userEmail);
    if (stored) return stored;
    return { usuarioEmail: userEmail, ...DEFAULT_PREFS };
  },

  async savePreferencia(userEmail: string, input: PreferenciaInput): Promise<Preferencia> {
    return notificacaoRepository.upsertPreferencia(userEmail, input);
  },
};
