/**
 * DTOs para threadReplies e closure (específico de demandas Slack).
 */
import { z } from 'zod';

export const addReplySchema = z.object({
  texto: z.string().trim().min(1).max(20000),
  timestampMsg: z.string().datetime().optional(),
  ehMembroEquipe: z.boolean().default(true),
  temCheckReaction: z.boolean().default(false),
  temLoadingReaction: z.boolean().default(false),
  arquivos: z.array(z.unknown()).max(50).optional(),
});
export type AddReplyInput = z.infer<typeof addReplySchema>;

export interface ThreadReply {
  id: string;
  demandaId: string;
  autor: string;
  texto: string;
  timestampMsg: Date;
  ehMembroEquipe: boolean;
  temCheckReaction: boolean;
  temLoadingReaction: boolean;
  arquivos: unknown[] | null;
  criadoEm: Date;
}

/** Closure fields — flexível porque pode evoluir (categoria, motivo, etc) */
export const updateClosureSchema = z.object({
  categoria: z.string().max(200).optional(),
  expirationReason: z.string().max(500).optional(),
  supportLevel: z.string().max(50).optional(),
  internalComment: z.string().max(5000).optional(),
  autoFilled: z.record(z.string(), z.boolean()).optional(),
});
export type UpdateClosureInput = z.infer<typeof updateClosureSchema>;
