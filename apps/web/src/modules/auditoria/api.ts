/**
 * Funções HTTP do módulo Auditoria. Mster-only via authenticate +
 * requirePerfil('master') no backend.
 */
import { apiClient } from '@/lib/api/client';
import { unwrapPaginated } from '@/lib/api/response-mapper';
import type { AuditoriaPaginated, AuditoriaQuery } from './types';

export const auditoriaApi = {
  async list(query: AuditoriaQuery = {}): Promise<AuditoriaPaginated> {
    const params = new URLSearchParams();
    if (query.pagina) params.set('pagina', String(query.pagina));
    if (query.limite) params.set('limite', String(query.limite));
    if (query.recurso) params.set('recurso', query.recurso);
    if (query.acao) params.set('acao', query.acao);
    if (query.usuarioEmail) params.set('usuarioEmail', query.usuarioEmail);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);

    const qs = params.toString();
    const url = qs ? `/auditoria?${qs}` : '/auditoria';
    // unwrapPaginated retorna { sucesso, dados, total, pagina, limite, totalPaginas }
    const res = await apiClient.get(url);
    const env = unwrapPaginated(res as never);
    return env as unknown as AuditoriaPaginated;
  },
};
