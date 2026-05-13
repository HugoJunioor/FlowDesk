/**
 * Zod schemas pros formularios de nota.
 */
import { z } from 'zod';

export const NOTE_STATUSES = ['todo', 'doing', 'done'] as const;

export const notaFormSchema = z.object({
  titulo: z.string().trim().min(1, 'Título obrigatório').max(500),
  conteudo: z.string().max(20000).default(''),
  status: z.enum(NOTE_STATUSES).default('todo'),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  cor: z.string().max(50).nullable().optional(),
});
export type NotaFormValues = z.infer<typeof notaFormSchema>;
