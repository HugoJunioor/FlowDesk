/**
 * Repositório do módulo Template — acesso ao Postgres via pg.Pool.
 *
 * Regras (padrão Just):
 *   - Sempre queries parametrizadas ($1, $2, ...). NUNCA string concat.
 *   - Use helpers de @shared/database/query-builder pra INSERT/UPDATE.
 *   - Retorna entidades planas (sem agregação) — composição é do service.
 *   - Sem regra de negócio aqui.
 *
 * Este módulo é exemplo funcional do padrão — copie pra criar outros.
 */
import { pool } from '@config/database';
import { buildInsert, buildUpdate, paginate, sanitizeSearch } from '@shared/database/query-builder';
import type {
  CreateTemplateInput,
  ListTemplateQuery,
  Template,
  UpdateTemplateInput,
} from './_template.dto';

interface TemplateRow {
  id: string;
  nome: string;
  descricao: string | null;
  criado_em: Date;
  atualizado_em: Date;
  excluido_em: Date | null;
}

function rowToEntity(row: TemplateRow): Template {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export const templateRepository = {
  async list(query: ListTemplateQuery): Promise<{ rows: Template[]; total: number }> {
    const { limit, offset } = paginate(query.pagina, query.limite);
    const values: unknown[] = [];
    let where = 'excluido_em IS NULL';
    if (query.busca) {
      values.push(sanitizeSearch(query.busca));
      where += ` AND nome ILIKE $${values.length}`;
    }

    const countRes = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM tb_template WHERE ${where}`,
      values,
    );
    const total = Number(countRes.rows[0]?.total ?? 0);

    values.push(limit);
    values.push(offset);
    const listRes = await pool.query<TemplateRow>(
      `SELECT id, nome, descricao, criado_em, atualizado_em, excluido_em
       FROM tb_template
       WHERE ${where}
       ORDER BY criado_em DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      rows: listRes.rows.map(rowToEntity),
      total,
    };
  },

  async findById(id: string): Promise<Template | null> {
    const res = await pool.query<TemplateRow>(
      `SELECT id, nome, descricao, criado_em, atualizado_em, excluido_em
       FROM tb_template
       WHERE id = $1 AND excluido_em IS NULL`,
      [id],
    );
    const row = res.rows[0];
    return row ? rowToEntity(row) : null;
  },

  async create(input: CreateTemplateInput): Promise<Template> {
    const { sql, values } = buildInsert(
      'tb_template',
      { nome: input.nome, descricao: input.descricao ?? null },
      ['id', 'nome', 'descricao', 'criado_em', 'atualizado_em', 'excluido_em'],
    );
    const res = await pool.query<TemplateRow>(sql, values);
    const row = res.rows[0];
    if (!row) throw new Error('INSERT em tb_template não retornou linha');
    return rowToEntity(row);
  },

  async update(id: string, input: UpdateTemplateInput): Promise<Template | null> {
    const { sql, values } = buildUpdate(
      'tb_template',
      {
        ...(input.nome !== undefined && { nome: input.nome }),
        ...(input.descricao !== undefined && { descricao: input.descricao }),
        atualizado_em: new Date(),
      },
      { id },
      ['id', 'nome', 'descricao', 'criado_em', 'atualizado_em', 'excluido_em'],
    );
    const res = await pool.query<TemplateRow>(sql, values);
    const row = res.rows[0];
    return row ? rowToEntity(row) : null;
  },

  async remove(id: string): Promise<boolean> {
    // Soft delete: marca excluido_em mantendo histórico
    const res = await pool.query(
      `UPDATE tb_template SET excluido_em = NOW()
       WHERE id = $1 AND excluido_em IS NULL`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  },
};
