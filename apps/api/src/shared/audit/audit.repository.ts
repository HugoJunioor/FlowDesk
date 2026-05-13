/**
 * Repositório de audit log — apenas INSERT (tabela append-only).
 *
 * Não tem update nem delete por design. Retenção via cron externo.
 */
import { pool } from '@config/database';

export interface AuditEntry {
  usuarioEmail: string | null;
  recurso: string;
  recursoId: string | null;
  acao: string;
  payloadAntes?: unknown;
  payloadDepois?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export const auditRepository = {
  async log(entry: AuditEntry): Promise<void> {
    await pool.query(
      `INSERT INTO tb_auditoria
         (usuario_email, recurso, recurso_id, acao,
          payload_antes, payload_depois, ip, user_agent, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.usuarioEmail,
        entry.recurso,
        entry.recursoId,
        entry.acao,
        entry.payloadAntes ? JSON.stringify(entry.payloadAntes) : null,
        entry.payloadDepois ? JSON.stringify(entry.payloadDepois) : null,
        entry.ip ?? null,
        entry.userAgent ? entry.userAgent.slice(0, 1000) : null,
        entry.requestId ?? null,
      ],
    );
  },
};
