/**
 * Service do módulo Template — regra de negócio pura.
 *
 * Regras:
 *   - Recebe dados já validados (vem do controller).
 *   - Lança DomainError pra erros de negócio; nunca retorna null pra erro.
 *   - Sem conhecimento de HTTP (sem req/res).
 *   - Chama repository, agrega, aplica regras, retorna.
 */
import { NotFoundError } from '@shared/domain/errors';
import { templateRepository } from './_template.repository';
import type {
  CreateTemplateInput,
  ListTemplateQuery,
  Template,
  UpdateTemplateInput,
} from './_template.dto';

export const templateService = {
  async list(query: ListTemplateQuery): Promise<{
    dados: Template[];
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  }> {
    const { rows, total } = await templateRepository.list(query);
    return {
      dados: rows,
      total,
      pagina: query.pagina,
      limite: query.limite,
      totalPaginas: Math.max(1, Math.ceil(total / query.limite)),
    };
  },

  async findById(id: string): Promise<Template> {
    const t = await templateRepository.findById(id);
    if (!t) throw new NotFoundError('Template', id);
    return t;
  },

  async create(input: CreateTemplateInput): Promise<Template> {
    return templateRepository.create(input);
  },

  async update(id: string, input: UpdateTemplateInput): Promise<Template> {
    const updated = await templateRepository.update(id, input);
    if (!updated) throw new NotFoundError('Template', id);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const removed = await templateRepository.remove(id);
    if (!removed) throw new NotFoundError('Template', id);
  },
};
