/**
 * Repositório de notas.
 *
 * Notas e items são tabelas separadas (tb_nota + tb_item_nota). A
 * camada repo agrega tudo em uma entidade Nota (com items embedded)
 * pra simplificar a API.
 *
 * Items são re-criados a cada UPDATE da nota (DELETE + INSERT) — mais
 * simples que tracking individual e cabe na escala (até 100 items por nota).
 */
import { pool } from '@config/database';
import { buildInsert } from '@shared/database/query-builder';
import type {
  ChecklistItem,
  ChecklistItemInput,
  CreateNotaInput,
  Nota,
  NoteStatus,
  UpdateNotaInput,
} from './nota.dto';

interface NotaRow {
  id: string;
  usuario_email: string;
  titulo: string;
  conteudo: string;
  status: NoteStatus;
  tags: string[];
  cor: string | null;
  ordem: string; // bigint vem como string
  criado_em: Date;
  atualizado_em: Date;
  excluido_em: Date | null;
}

interface ItemRow {
  id: string;
  nota_id: string;
  texto: string;
  feito: boolean;
  ordem: number;
  criado_em: Date;
  atualizado_em: Date;
}

function rowToNota(row: NotaRow, items: ChecklistItem[]): Nota {
  return {
    id: row.id,
    usuarioEmail: row.usuario_email,
    titulo: row.titulo,
    conteudo: row.conteudo,
    status: row.status,
    tags: row.tags,
    cor: row.cor,
    ordem: Number(row.ordem),
    items,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function rowToItem(row: ItemRow): ChecklistItem {
  return {
    id: row.id,
    texto: row.texto,
    feito: row.feito,
    ordem: row.ordem,
  };
}

async function fetchItems(notaIds: string[]): Promise<Map<string, ChecklistItem[]>> {
  const result = new Map<string, ChecklistItem[]>();
  if (notaIds.length === 0) return result;
  const res = await pool.query<ItemRow>(
    `SELECT * FROM tb_item_nota
     WHERE nota_id = ANY($1::uuid[])
     ORDER BY ordem ASC, criado_em ASC`,
    [notaIds],
  );
  for (const row of res.rows) {
    const arr = result.get(row.nota_id) ?? [];
    arr.push(rowToItem(row));
    result.set(row.nota_id, arr);
  }
  return result;
}

export const notaRepository = {
  async listByUser(email: string): Promise<Nota[]> {
    const res = await pool.query<NotaRow>(
      `SELECT * FROM tb_nota
       WHERE usuario_email = $1 AND excluido_em IS NULL
       ORDER BY ordem ASC, criado_em ASC`,
      [email],
    );
    const itemsMap = await fetchItems(res.rows.map((r) => r.id));
    return res.rows.map((r) => rowToNota(r, itemsMap.get(r.id) ?? []));
  },

  async findById(id: string): Promise<Nota | null> {
    const res = await pool.query<NotaRow>(
      `SELECT * FROM tb_nota
       WHERE id = $1 AND excluido_em IS NULL
       LIMIT 1`,
      [id],
    );
    const row = res.rows[0];
    if (!row) return null;
    const itemsMap = await fetchItems([row.id]);
    return rowToNota(row, itemsMap.get(row.id) ?? []);
  },

  async create(usuarioEmail: string, input: CreateNotaInput): Promise<Nota> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { sql, values } = buildInsert(
        'tb_nota',
        {
          usuario_email: usuarioEmail,
          titulo: input.titulo,
          conteudo: input.conteudo,
          status: input.status,
          tags: input.tags,
          cor: input.cor ?? null,
          ordem: Date.now(),
        },
        ['*'],
      );
      const notaRes = await client.query<NotaRow>(sql, values);
      const notaRow = notaRes.rows[0];
      if (!notaRow) throw new Error('INSERT em tb_nota nao retornou linha');

      const items = await insertItems(client, notaRow.id, input.items);
      await client.query('COMMIT');
      return rowToNota(notaRow, items);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id: string, input: UpdateNotaInput): Promise<Nota | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Build dynamic SET clause manualmente pra controlar tipos
      const setParts: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      const add = (col: string, val: unknown): void => {
        setParts.push(`${col} = $${idx++}`);
        values.push(val);
      };
      if (input.titulo !== undefined) add('titulo', input.titulo);
      if (input.conteudo !== undefined) add('conteudo', input.conteudo);
      if (input.status !== undefined) add('status', input.status);
      if (input.tags !== undefined) add('tags', input.tags);
      if (input.cor !== undefined) add('cor', input.cor);
      if (input.ordem !== undefined) add('ordem', input.ordem);
      setParts.push(`atualizado_em = NOW()`);

      let notaRow: NotaRow | undefined;
      if (setParts.length > 1) {
        // tem algo além do atualizado_em
        values.push(id);
        const res = await client.query<NotaRow>(
          `UPDATE tb_nota SET ${setParts.join(', ')}
           WHERE id = $${idx} AND excluido_em IS NULL
           RETURNING *`,
          values,
        );
        notaRow = res.rows[0];
      } else {
        const res = await client.query<NotaRow>(
          `SELECT * FROM tb_nota WHERE id = $1 AND excluido_em IS NULL`,
          [id],
        );
        notaRow = res.rows[0];
      }
      if (!notaRow) {
        await client.query('ROLLBACK');
        return null;
      }

      // Items: se vier no input, substitui o conjunto inteiro
      let items: ChecklistItem[];
      if (input.items !== undefined) {
        await client.query('DELETE FROM tb_item_nota WHERE nota_id = $1', [id]);
        items = await insertItems(client, id, input.items);
      } else {
        const itemsMap = await fetchItems([id]);
        items = itemsMap.get(id) ?? [];
      }

      await client.query('COMMIT');
      return rowToNota(notaRow, items);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async softDelete(id: string): Promise<boolean> {
    const res = await pool.query(
      `UPDATE tb_nota SET excluido_em = NOW()
       WHERE id = $1 AND excluido_em IS NULL`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  },
};

async function insertItems(
  client: { query: typeof pool.query },
  notaId: string,
  items: ChecklistItemInput[],
): Promise<ChecklistItem[]> {
  if (items.length === 0) return [];
  const result: ChecklistItem[] = [];
  let ordem = 0;
  for (const item of items) {
    const res = await client.query<ItemRow>(
      `INSERT INTO tb_item_nota (nota_id, texto, feito, ordem)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [notaId, item.texto, item.feito ?? false, ordem++],
    );
    const row = res.rows[0];
    if (row) result.push(rowToItem(row));
  }
  return result;
}
