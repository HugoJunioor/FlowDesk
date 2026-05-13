/**
 * DTOs do módulo Auditoria — consulta da trilha (apenas master).
 *
 * Read-only: tb_auditoria é append-only e populada pelo middleware
 * + chamadas explícitas do controller auth.
 */
import { z } from 'zod';

export const listAuditoriaQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(200).default(50),
  recurso: z.string().min(1).max(50).optional(),
  acao: z.string().min(1).max(50).optional(),
  usuarioEmail: z.string().email().optional(),
  /** ISO timestamp inicial (inclusive) */
  from: z.string().datetime().optional(),
  /** ISO timestamp final (exclusive) */
  to: z.string().datetime().optional(),
});
export type ListAuditoriaQuery = z.infer<typeof listAuditoriaQuerySchema>;

export interface AuditoriaEntry {
  id: string;
  usuarioEmail: string | null;
  recurso: string;
  recursoId: string | null;
  acao: string;
  payloadAntes: unknown;
  payloadDepois: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  criadoEm: Date;
}
