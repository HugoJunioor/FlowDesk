/**
 * DTOs do módulo Nota (bloco de notas pessoal).
 *
 * Cada nota pertence a UM usuário. Visibilidade enforced server-side
 * via req.user.email — frontend não precisa passar email.
 */
import { z } from 'zod';

export const NOTE_STATUSES = ['todo', 'doing', 'done'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const checklistItemSchema = z.object({
  id: z.string().uuid().optional(),
  texto: z.string().trim().min(1).max(500),
  feito: z.boolean().default(false),
});
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;

export const createNotaSchema = z.object({
  titulo: z.string().trim().min(1).max(500),
  conteudo: z.string().max(20000).default(''),
  status: z.enum(NOTE_STATUSES).default('todo'),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  cor: z.string().max(50).nullable().optional(),
  items: z.array(checklistItemSchema).max(100).default([]),
});
export type CreateNotaInput = z.infer<typeof createNotaSchema>;

export const updateNotaSchema = z.object({
  titulo: z.string().trim().min(1).max(500).optional(),
  conteudo: z.string().max(20000).optional(),
  status: z.enum(NOTE_STATUSES).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  cor: z.string().max(50).nullable().optional(),
  ordem: z.number().int().optional(),
  items: z.array(checklistItemSchema).max(100).optional(),
});
export type UpdateNotaInput = z.infer<typeof updateNotaSchema>;

export interface ChecklistItem {
  id: string;
  texto: string;
  feito: boolean;
  ordem: number;
}

export interface Nota {
  id: string;
  usuarioEmail: string;
  titulo: string;
  conteudo: string;
  status: NoteStatus;
  tags: string[];
  cor: string | null;
  ordem: number;
  items: ChecklistItem[];
  criadoEm: Date;
  atualizadoEm: Date;
}
