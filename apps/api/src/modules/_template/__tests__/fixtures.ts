/**
 * Factories de objetos para os testes do módulo Template.
 *
 * Padrão Just: prefira factories sobre objetos hardcoded. Permite
 * customizar só os campos relevantes do teste sem repetir todo o shape.
 */
import type { Template } from '../_template.dto';

export function makeTemplate(overrides: Partial<Template> = {}): Template {
  const now = new Date('2026-05-12T10:00:00Z');
  return {
    id: '00000000-0000-4000-8000-000000000001',
    nome: 'Template de teste',
    descricao: null,
    criadoEm: now,
    atualizadoEm: now,
    ...overrides,
  };
}
