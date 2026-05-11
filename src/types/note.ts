/**
 * Bloco de notas pessoal — notas por usuario com Kanban simples.
 *
 * Cada nota pertence a UM usuario (userEmail). Visivel so pra ele.
 * Status define a coluna do Kanban; tags livres pra filtros.
 */

export type NoteStatus = "todo" | "doing" | "done";

export interface Note {
  id: string;
  userEmail: string;
  title: string;
  content: string;
  status: NoteStatus;
  tags: string[];
  /** Cor de destaque opcional (hex ou nome de classe Tailwind) */
  color: string | null;
  /** Ordem dentro da coluna — menor = topo. Default Date.now() */
  order: number;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<NoteStatus, string> = {
  todo: "A fazer",
  doing: "Fazendo",
  done: "Feito",
};

export const STATUS_ORDER: NoteStatus[] = ["todo", "doing", "done"];

export const NOTE_COLORS: { name: string; value: string; bg: string }[] = [
  { name: "Padrão", value: "default", bg: "bg-card" },
  { name: "Amarelo", value: "yellow", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
  { name: "Verde", value: "green", bg: "bg-green-50 dark:bg-green-950/30" },
  { name: "Azul", value: "blue", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { name: "Roxo", value: "purple", bg: "bg-purple-50 dark:bg-purple-950/30" },
  { name: "Rosa", value: "pink", bg: "bg-pink-50 dark:bg-pink-950/30" },
];

export function colorBgClass(color: string | null): string {
  const c = NOTE_COLORS.find((x) => x.value === color);
  return c ? c.bg : "bg-card";
}
