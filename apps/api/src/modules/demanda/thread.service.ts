/**
 * Service de threadReply + closure pra demandas.
 *
 * Operações exigem que a demanda exista (NotFound senão). Adição de
 * reply é permitida pra qualquer autenticado que tenha acesso à
 * demanda (filtros de visibilidade ficam no controller via auth+perms).
 */
import { NotFoundError } from '@shared/domain/errors';
import { demandaRepository } from './demanda.repository';
import { threadRepository } from './thread.repository';
import type { AddReplyInput, ThreadReply, UpdateClosureInput } from './thread.dto';

export const threadService = {
  async list(demandaId: string): Promise<ThreadReply[]> {
    const demanda = await demandaRepository.findById(demandaId);
    if (!demanda) throw new NotFoundError('Demanda', demandaId);
    return threadRepository.listByDemanda(demandaId);
  },

  async add(
    demandaId: string,
    autor: string,
    input: AddReplyInput,
  ): Promise<ThreadReply> {
    const demanda = await demandaRepository.findById(demandaId);
    if (!demanda) throw new NotFoundError('Demanda', demandaId);
    return threadRepository.add(demandaId, autor, input);
  },

  async updateClosure(demandaId: string, input: UpdateClosureInput): Promise<unknown> {
    const demanda = await demandaRepository.findById(demandaId);
    if (!demanda) throw new NotFoundError('Demanda', demandaId);
    return threadRepository.updateClosure(demandaId, input);
  },
};
