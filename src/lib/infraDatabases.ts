/**
 * Lista de bancos de dados disponiveis no modulo Infra (SQL).
 * Configurada pelo master via UI ou diretamente no storage compartilhado.
 *
 * Persistencia: localStorage key "fd_infra_databases" — sincronizada com
 * outros dispositivos via stateSync plugin (lista em SYNCED_KEYS).
 *
 * Formato: array de strings (nome do banco). Ex: ["vspay", "efleet"].
 */
import { setSyncedItem } from "./stateSync";

const KEY = "fd_infra_databases";

/** Bancos sugeridos por padrao quando a lista esta vazia */
const DEFAULTS: string[] = [
  "vspay",
  "efleet",
  "smartvale",
  "dxtech",
  "kpi",
];

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
