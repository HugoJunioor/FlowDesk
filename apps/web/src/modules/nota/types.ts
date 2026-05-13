/**
 * Types do modulo Nota. Espelha apps/api/src/modules/nota/nota.dto.ts.
 */
export type NoteStatus = 'todo' | 'doing' | 'done';

export interface ChecklistItem {
  id: string;
  texto: string;
  feito: boolean;
  ordem: number;
}

export interface ChecklistItemInput {
  id?: string;
  texto: string;
  feito?: boolean;
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
  criadoEm: string;
  atualizadoEm: string;
}

export interface CreateNotaInput {
  titulo: string;
  conteudo?: string;
  status?: NoteStatus;
  tags?: string[];
  cor?: string | null;
  items?: ChecklistItemInput[];
}

export interface UpdateNotaInput {
  titulo?: string;
  conteudo?: string;
  status?: NoteStatus;
  tags?: string[];
  cor?: string | null;
  ordem?: number;
  items?: ChecklistItemInput[];
}
