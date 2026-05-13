/**
 * Repositório para thread_reply + closure.
 *
 * Closure fica no jsonb da própria tb_demanda, não tem tabela separada.
 * threadReplies tem tabela própria pra suportar paginação e queries
 * tipo "última reply da equipe" (usado pelo SLA).
 */
import { pool } from '@config/database';
import { buildInsert } from '@shared/database/query-builder';
import type { AddReplyInput, ThreadReply, UpdateClosureInput } from './thread.dto';

interface ThreadReplyRow {
  id: string;
  demanda_id: string;
  autor: string;
  texto: string;
  timestamp_msg: Date;
  eh_membro_equipe: boolean;
  tem_check_reaction: boolean;
  tem_loading_reaction: boolean;
  arquivos: unknown[] | null;
  criado_em: Date;
}

function rowToReply(r: ThreadReplyRow): ThreadReply {
  return {
    id: r.id,
    demandaId: r.demanda_id,
    autor: r.autor,
    texto: r.texto,
    timestampMsg: r.timestamp_msg,
    ehMembroEquipe: r.eh_membro_equipe,
    temCheckReaction: r.tem_check_reaction,
    temLoadingReaction: r.tem_loading_reaction,
    arquivos: r.arquivos,
    criadoEm: r.criado_em,
  };
}

export const threadRepository = {
  async listByDemanda(demandaId: string): Promise<ThreadReply[]> {
    const res = await pool.query<ThreadReplyRow>(
      `SELECT * FROM tb_thread_reply
       WHERE demanda_id = $1
       ORDER BY timestamp_msg ASC, criado_em ASC`,
      [demandaId],
    );
    return res.rows.map(rowToReply);
  },

  async add(demandaId: string, autor: string, input: AddReplyInput): Promise<ThreadReply> {
    const { sql, values } = buildInsert(
      'tb_thread_reply',
      {
        demanda_id: demandaId,
        autor,
        texto: input.texto,
        timestamp_msg: input.timestampMsg ? new Date(input.timestampMsg) : new Date(),
        eh_membro_equipe: input.ehMembroEquipe,
        tem_check_reaction: input.temCheckReaction,
        tem_loading_reaction: input.temLoadingReaction,
        arquivos: input.arquivos ? JSON.stringify(input.arquivos) : null,
      },
      ['*'],
    );
    const res = await pool.query<ThreadReplyRow>(sql, values);
    const row = res.rows[0];
    if (!row) throw new Error('INSERT em tb_thread_reply nao retornou linha');

    // Incrementa contador replies na demanda
    await pool.query(
      `UPDATE tb_demanda SET replies = replies + 1, atualizado_em = NOW()
       WHERE id = $1`,
      [demandaId],
    );

    return rowToReply(row);
  },

  // ===== Closure =====

  async updateClosure(demandaId: string, input: UpdateClosureInput): Promise<unknown> {
    // Merge no jsonb existente — preserva campos nao mexidos
    const res = await pool.query<{ closure: unknown }>(
      `UPDATE tb_demanda
       SET closure = COALESCE(closure, '{}'::jsonb) || $1::jsonb,
           atualizado_em = NOW()
       WHERE id = $2 AND excluido_em IS NULL
       RETURNING closure`,
      [JSON.stringify(input), demandaId],
    );
    return res.rows[0]?.closure ?? null;
  },
};
