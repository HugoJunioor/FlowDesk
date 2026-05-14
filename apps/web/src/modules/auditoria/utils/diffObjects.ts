/**
 * diffObjects — compara dois objetos JSON e retorna lista de diferencas campo a campo.
 *
 * Retorna apenas campos de nivel superior. Objetos/arrays aninhados sao
 * comparados por valor serializado (JSON.stringify), sem expandir recursivamente —
 * born suficiente para os payloads de auditoria do FlowDesk.
 */

export type DiffOp = 'change' | 'add' | 'remove';

export interface DiffEntry {
  key: string;
  before: unknown;
  after: unknown;
  op: DiffOp;
}

type PlainObject = Record<string, unknown>;

function isPlainObject(v: unknown): v is PlainObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Compara `before` e `after` e devolve array de entradas com as diferencas.
 * Campos identicos (===, ou JSON igual para objetos/arrays) sao omitidos.
 * Ordem: changes primeiro, depois adds, depois removes.
 */
export function diffObjects(
  before: unknown,
  after: unknown,
): DiffEntry[] {
  const b: PlainObject = isPlainObject(before) ? before : {};
  const a: PlainObject = isPlainObject(after) ? after : {};

  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changes: DiffEntry[] = [];
  const adds: DiffEntry[] = [];
  const removes: DiffEntry[] = [];

  for (const key of allKeys) {
    const hasB = Object.prototype.hasOwnProperty.call(b, key);
    const hasA = Object.prototype.hasOwnProperty.call(a, key);

    if (hasB && hasA) {
      // Presente nos dois — verifica se mudou
      const bVal = b[key];
      const aVal = a[key];
      const equal =
        bVal === aVal ||
        JSON.stringify(bVal) === JSON.stringify(aVal);
      if (!equal) {
        changes.push({ key, before: bVal, after: aVal, op: 'change' });
      }
    } else if (!hasB && hasA) {
      adds.push({ key, before: undefined, after: a[key], op: 'add' });
    } else if (hasB && !hasA) {
      removes.push({ key, before: b[key], after: undefined, op: 'remove' });
    }
  }

  return [...changes, ...adds, ...removes];
}

/** Formata um valor de diff para exibicao legivel. */
export function formatDiffValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}
