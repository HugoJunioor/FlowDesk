/**
 * DTOs (Data Transfer Objects) do módulo Template.
 *
 * Cada operação tem um schema Zod e um type derivado (z.infer). Esses
 * schemas são usados pelo validation.middleware nas rotas.
 *
 * Regra: nunca exporte um type sem schema. O schema é a fonte da verdade.
 */
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('ID precisa ser UUID válido'),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const listTemplateQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(100).default(20),
  busca: z.string().trim().min(1).optional(),
});
export type ListTemplateQuery = z.infer<typeof listTemplateQuerySchema>;

export const createTemplateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome obrigatório').max(255),
  descricao: z.string().trim().max(1000).optional(),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  nome: z.string().trim().min(1).max(255).optional(),
  descricao: z.string().trim().max(1000).optional(),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/** Entidade interna (depois ligada à row do banco). */
export interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}
