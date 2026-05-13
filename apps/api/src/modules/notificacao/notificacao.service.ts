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
  canais: { inbox: true, browserPush: false, email: false },
  slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
};

export const notificacaoService = {
  async listMine(userEmail: string): Promise<Notificacao[]> {
    return notificacaoRepository.listByUser(userEmail, MAX_PER_USER);
  },

  async create(input: CreateNotificacaoInput): Promise<Notificacao> {
    const created = await notificacaoRepository.create(input);
    // Mantem FIFO de 500 — apaga as mais antigas se ultrapassar
    void notificacaoRepository.pruneByUser(input.usuarioEmail, MAX_PER_USER);
    return created;
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
