/**
 * Service de notas.
 *
 * Ownership SEMPRE validado server-side via req.user.email. Frontend
 * nunca passa email — vem do contexto autenticado.
 *
 * Regras:
 *   - findById só retorna se for do user
 *   - update/delete só permitidos pelo dono
 *   - listMine filtra por user automaticamente
 */
import { NotFoundError, ForbiddenError } from '@shared/domain/errors';
import { notaRepository } from './nota.repository';
import type { CreateNotaInput, Nota, UpdateNotaInput } from './nota.dto';

async function getOwnNotaOrThrow(id: string, email: string): Promise<Nota> {
  const nota = await notaRepository.findById(id);
  if (!nota) throw new NotFoundError('Nota', id);
  if (nota.usuarioEmail.toLowerCase() !== email.toLowerCase()) {
    // Não vaza informação — comporta-se como se não existisse
    throw new NotFoundError('Nota', id);
  }
  return nota;
}

export const notaService = {
  async listMine(email: string): Promise<Nota[]> {
    return notaRepository.listByUser(email);
  },

  async findOne(id: string, email: string): Promise<Nota> {
    return getOwnNotaOrThrow(id, email);
  },

  async create(email: string, input: CreateNotaInput): Promise<Nota> {
    return notaRepository.create(email, input);
  },

  async update(id: string, email: string, input: UpdateNotaInput): Promise<Nota> {
    // Valida ownership ANTES do update
    await getOwnNotaOrThrow(id, email);
    const updated = await notaRepository.update(id, input);
    if (!updated) throw new NotFoundError('Nota', id);
    return updated;
  },

  async remove(id: string, email: string): Promise<void> {
    await getOwnNotaOrThrow(id, email);
    const removed = await notaRepository.softDelete(id);
    if (!removed) throw new NotFoundError('Nota', id);
  },

  /** Atalho — usado pelo toggle de checklist no card sem abrir editor */
  async toggleChecklistItem(
    notaId: string,
    itemId: string,
    email: string,
    feito: boolean,
  ): Promise<Nota> {
    const nota = await getOwnNotaOrThrow(notaId, email);
    const items = nota.items.map((it) =>
      it.id === itemId ? { ...it, feito } : it,
    );
    if (!items.some((it) => it.id === itemId)) {
      throw new NotFoundError('Item', itemId);
    }
    if (items.some((it) => it.id === itemId && (
      it.feito !== feito ? false : true
    )) === false) {
      // (no-op guard)
    }
    const updated = await notaRepository.update(notaId, {
      items: items.map((it) => ({ id: it.id, texto: it.texto, feito: it.feito })),
    });
    if (!updated) throw new ForbiddenError('Falha ao atualizar item');
    return updated;
  },
};
