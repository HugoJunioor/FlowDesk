/**
 * Repositório de consulta da auditoria.
 *
 * Read-only — escritas vão pelo shared/audit/audit.service.ts. Aqui só
 * SELECT com filtros e paginação.
 */
import { pool } from '@config/database';
import { paginate } from '@shared/database/query-builder';
import type { AuditoriaEntry, ListAuditoriaQuery } from './auditoria.dto';

interface AuditoriaRow {
  id: string;
  usuario_email: string | null;
  recurso: string;
  recurso_id: string | null;
  acao: string;
  payload_antes: unknown;
  payload_depois: unknown;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  criado_em: Date;
}

function rowToEntry(r: AuditoriaRow): AuditoriaEntry {
  return {
    id: r.id,
    usuarioEmail: r.usuario_email,
    recurso: r.recurso,
    recursoId: r.recurso_id,
    acao: r.acao,
    payloadAntes: r.payload_antes,
    payloadDepois: r.payload_depois,
    ip: r.ip,
    userAgent: r.user_agent,
    requestId: r.request_id,
    criadoEm: r.criado_em,
  };
}

export const auditoriaRepository = {
  async list(
    query: ListAuditoriaQuery,
  ): Promise<{ rows: AuditoriaEntry[]; total: number }> {
    const { limit, offset } = paginate(query.pagina, query.limite);
    const conds: string[] = [];
    const values: unknown[] = [];
    if (query.recurso) {
      values.push(query.recurso);
      conds.push(`recurso = $${values.length}`);
    }
    if (query.acao) {
      values.push(query.acao);
      conds.push(`acao = $${values.length}`);
    }
    if (query.usuarioEmail) {
      values.push(query.usuarioEmail);
      conds.push(`usuario_email = $${values.length}`);
    }
    if (query.from) {
      values.push(new Date(query.from));
      conds.push(`criado_em >= $${values.length}`);
    }
    if (query.to) {
      values.push(new Date(query.to));
      conds.push(`criado_em < $${values.length}`);
    }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

    const totalRes = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM tb_auditoria ${where}`,
      values,
    );
    const total = Number(totalRes.rows[0]?.total ?? 0);

    values.push(limit);
    values.push(offset);
    const listRes = await pool.query<AuditoriaRow>(
      `SELECT * FROM tb_auditoria ${where}
       ORDER BY criado_em DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return { rows: listRes.rows.map(rowToEntry), total };
  },
};
