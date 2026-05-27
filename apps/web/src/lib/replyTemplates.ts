/**
 * Templates de resposta — atalhos de mensagens recorrentes pro composer.
 *
 * Storage: localStorage `fd_reply_templates` (array). Sincroniza com legacy-state
 * via stateSync interceptor (igual outras chaves fd_*).
 *
 * Cada template: { id, name, body, createdAt }
 */
const STORAGE_KEY = 'fd_reply_templates';

export interface ReplyTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
}

function genId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_TEMPLATES: ReplyTemplate[] = [
  {
    id: 'tpl_default_providing',
    name: 'Vamos providenciar',
    body: 'Boa tarde! Vamos providenciar.',
    createdAt: new Date(0).toISOString(),
  },
  {
    id: 'tpl_default_completed',
    name: 'Concluído',
    body: 'Concluído! Por favor, valide.',
    createdAt: new Date(0).toISOString(),
  },
  {
    id: 'tpl_default_checking',
    name: 'Verificando',
    body: 'Estamos verificando e retornamos em instantes.',
    createdAt: new Date(0).toISOString(),
  },
];

export function listTemplates(): ReplyTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Primeira vez — popula defaults
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveTemplate(input: { id?: string; name: string; body: string }): ReplyTemplate {
  const all = listTemplates();
  const idx = input.id ? all.findIndex((t) => t.id === input.id) : -1;
  if (idx >= 0) {
    all[idx] = { ...all[idx], name: input.name, body: input.body };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all[idx];
  }
  const tpl: ReplyTemplate = {
    id: genId(),
    name: input.name,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  all.push(tpl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return tpl;
}

export function deleteTemplate(id: string): void {
  const all = listTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
