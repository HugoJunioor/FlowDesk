/**
 * Repositório de notificações.
 * Queries parametrizadas, soft FIFO via LIMIT.
 */
import { pool } from '@config/database';
import { buildInsert } from '@shared/database/query-builder';
import type {
  CreateNotificacaoInput,
  Notificacao,
  NotificationEvent,
  Preferencia,
  PreferenciaInput,
} from './notificacao.dto';

interface NotificacaoRow {
  id: string;
  usuario_email: string;
  evento: NotificationEvent;
  origem: 'slack' | 'infra';
  demanda_id: string | null;
  titulo: string;
  mensagem: string | null;
  ator: string | null;
  lida: boolean;
  lida_em: Date | null;
  enviada_por: string[] | null;
  criado_em: Date;
}

interface PreferenciaRow {
  usuario_email: string;
  eventos: Record<string, boolean>;
  canais: { inbox: boolean; browserPush: boolean; email: boolean };
  sla_reminders: { p1Hours: number; p2Hours: number; p3Hours: number };
  atualizado_em: Date;
}

function rowToNotificacao(row: NotificacaoRow): Notificacao {
  return {
    id: row.id,
    usuarioEmail: row.usuario_email,
    evento: row.evento,
    origem: row.origem,
    demandaId: row.demanda_id,
    titulo: row.titulo,
    mensagem: row.mensagem,
    ator: row.ator,
    lida: row.lida,
    lidaEm: row.lida_em,
    enviadaPor: row.enviada_por,
    criadoEm: row.criado_em,
  };
}

function rowToPreferencia(row: PreferenciaRow): Preferencia {
  return {
    usuarioEmail: row.usuario_email,
    eventos: row.eventos,
    canais: row.canais,
    slaReminders: row.sla_reminders,
  };
}

export const notificacaoRepository = {
  async listByUser(email: string, limit = 200): Promise<Notificacao[]> {
    const res = await pool.query<NotificacaoRow>(
      `SELECT * FROM tb_notificacao
       WHERE usuario_email = $1
       ORDER BY criado_em DESC
       LIMIT $2`,
      [email, limit],
    );
    return res.rows.map(rowToNotificacao);
  },

  async create(input: CreateNotificacaoInput): Promise<Notificacao> {
    const { sql, values } = buildInsert(
      'tb_notificacao',
      {
        usuario_email: input.usuarioEmail,
        evento: input.evento,
        origem: input.origem,
        demanda_id: input.demandaId ?? null,
        titulo: input.titulo,
        mensagem: input.mensagem ?? null,
        ator: input.ator ?? null,
      },
      ['*'],
    );
    const res = await pool.query<NotificacaoRow>(sql, values);
    const row = res.rows[0];
    if (!row) throw new Error('INSERT em tb_notificacao não retornou linha');
    return rowToNotificacao(row);
  },

  async markRead(id: string, lida: boolean): Promise<Notificacao | null> {
    const res = await pool.query<NotificacaoRow>(
      `UPDATE tb_notificacao
       SET lida = $1, lida_em = CASE WHEN $1 THEN NOW() ELSE NULL END
       WHERE id = $2
       RETURNING *`,
      [lida, id],
    );
    const row = res.rows[0];
    return row ? rowToNotificacao(row) : null;
  },

  async markAllReadByUser(email: string): Promise<number> {
    const res = await pool.query(
      `UPDATE tb_notificacao
       SET lida = true, lida_em = NOW()
       WHERE usuario_email = $1 AND lida = false`,
      [email],
    );
    return res.rowCount ?? 0;
  },

  async pruneByUser(email: string, keepLatest: number): Promise<number> {
    // Mantém só as N mais recentes do user, apaga o resto
    const res = await pool.query(
      `DELETE FROM tb_notificacao
       WHERE id IN (
         SELECT id FROM tb_notificacao
         WHERE usuario_email = $1
         ORDER BY criado_em DESC
         OFFSET $2
       )`,
      [email, keepLatest],
    );
    return res.rowCount ?? 0;
  },

  // ===== Preferences =====

  async getPreferencia(email: string): Promise<Preferencia | null> {
    const res = await pool.query<PreferenciaRow>(
      `SELECT * FROM tb_preferencia_notificacao WHERE usuario_email = $1`,
      [email],
    );
    const row = res.rows[0];
    return row ? rowToPreferencia(row) : null;
  },

  async upsertPreferencia(
    email: string,
    input: PreferenciaInput,
  ): Promise<Preferencia> {
    const res = await pool.query<PreferenciaRow>(
      `INSERT INTO tb_preferencia_notificacao
         (usuario_email, eventos, canais, sla_reminders, atualizado_em)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (usuario_email) DO UPDATE
         SET eventos = EXCLUDED.eventos,
             canais = EXCLUDED.canais,
             sla_reminders = EXCLUDED.sla_reminders,
             atualizado_em = NOW()
       RETURNING *`,
      [
        email,
        JSON.stringify(input.eventos),
        JSON.stringify(input.canais),
        JSON.stringify(input.slaReminders),
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error('UPSERT em tb_preferencia_notificacao falhou');
    return rowToPreferencia(row);
  },
};
