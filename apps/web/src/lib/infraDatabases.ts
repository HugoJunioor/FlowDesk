/**
 * Lista de bancos de dados disponiveis no modulo Infra (SQL).
 * Configurada pelo master via UI ou diretamente no storage compartilhado.
 *
 * Persistencia: localStorage key "fd_infra_databases" — sincronizada com
 * outros dispositivos via stateSync plugin (lista em SYNCED_KEYS).
 *
 * Formato: array de strings (nome do banco). Ex: ["banco_a", "banco_b"].
 */
import { setSyncedItem } from "./stateSync";

const KEY = "fd_infra_databases";

/**
 * Vazio de proposito. Os bancos reais sao dado de producao e moram no estado
 * compartilhado (fd_infra_databases), nao no codigo — este repositorio e
 * publico. Numa instalacao nova a lista comeca vazia e o master adiciona pelo
 * proprio formulario, que tem input pra isso; o campo e opcional.
 *
 * Ate 2026-09-28 havia aqui cinco nomes reais de bancos, e como a chave nao
 * estava na SYNCED_KEYS do cliente, era exatamente esta lista que toda a equipe
 * via em producao.
 */
const DEFAULTS: string[] = [];

export function loadInfraDatabases(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
    return DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveInfraDatabases(list: string[]): void {
  const cleaned = Array.from(new Set(list.map((s) => s.trim()).filter(Boolean))).sort();
  setSyncedItem(KEY, JSON.stringify(cleaned));
}

export function addInfraDatabase(name: string): string[] {
  const list = loadInfraDatabases();
  const cleaned = name.trim();
  if (!cleaned || list.includes(cleaned)) return list;
  const updated = [...list, cleaned].sort();
  saveInfraDatabases(updated);
  return updated;
}
