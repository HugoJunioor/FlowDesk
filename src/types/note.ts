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
  { name: "Amarelo", value: "yellow", bg: "bg-yellow-100 dark:bg-yellow-800/40 dark:border-yellow-700/40" },
  { name: "Verde", value: "green", bg: "bg-green-100 dark:bg-green-800/40 dark:border-green-700/40" },
  { name: "Azul", value: "blue", bg: "bg-blue-100 dark:bg-blue-800/40 dark:border-blue-700/40" },
  { name: "Roxo", value: "purple", bg: "bg-purple-100 dark:bg-purple-800/40 dark:border-purple-700/40" },
  { name: "Rosa", value: "pink", bg: "bg-pink-100 dark:bg-pink-800/40 dark:border-pink-700/40" },
];

export function colorBgClass(color: string | null): string {
  const c = NOTE_COLORS.find((x) => x.value === color);
  return c ? c.bg : "bg-card";
}
