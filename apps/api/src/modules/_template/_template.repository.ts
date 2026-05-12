/**
 * Repositório do módulo Template — acesso ao banco.
 *
 * Regras:
 *   - Sempre queries parametrizadas ($1, $2, ...). NUNCA string concat.
 *   - Retorna entidades planas; composição/agregação é do service.
 *   - Sem regra de negócio aqui.
 *
 * ⚠️  Placeholder em memória — substitua por pg.Pool quando Fase 2
 *     entregar o schema.
 */
import { randomUUID } from 'node:crypto';
import type { CreateTemplateInput, ListTemplateQuery, Template, UpdateTemplateInput } from './_template.dto';

// Stub em memória — desaparece quando ligarmos no Postgres.
const memory = new Map<string, Template>();

export const templateRepository = {
  async list(query: ListTemplateQuery): Promise<{ rows: Template[]; total: number }> {
    let all = Array.from(memory.values());
    if (query.busca) {
      const q = query.busca.toLowerCase();
      all = all.filter((t) => t.nome.toLowerCase().includes(q));
    }
    const offset = (query.pagina - 1) * query.limite;
    return {
      rows: all.slice(offset, offset + query.limite),
      total: all.length,
    };
  },

  async findById(id: string): Promise<Template | null> {
    return memory.get(id) ?? null;
  },

  async create(input: CreateTemplateInput): Promise<Template> {
    const now = new Date();
    const t: Template = {
      id: randomUUID(),
      nome: input.nome,
      descricao: input.descricao ?? null,
      criadoEm: now,
      atualizadoEm: now,
    };
    memory.set(t.id, t);
    return t;
  },

  async update(id: string, input: UpdateTemplateInput): Promise<Template | null> {
    const current = memory.get(id);
    if (!current) return null;
    const updated: Template = {
      ...current,
      ...input,
      descricao: input.descricao ?? current.descricao,
      atualizadoEm: new Date(),
    };
    memory.set(id, updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    return memory.delete(id);
  },
};
