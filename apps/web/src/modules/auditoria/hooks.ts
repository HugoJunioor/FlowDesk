/**
 * Hooks React Query do módulo Auditoria.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { auditoriaApi } from './api';
import type { AuditoriaPaginated, AuditoriaQuery } from './types';

const QK = {
  list: (q: AuditoriaQuery) => ['auditoria', 'list', q] as const,
};

export function useAuditoriaList(query: AuditoriaQuery, opts: { enabled?: boolean } = {}) {
  return useQuery<AuditoriaPaginated, Error>({
    queryKey: QK.list(query),
    queryFn: () => auditoriaApi.list(query),
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData, // Mantem dados antigos enquanto carrega nova pagina
    staleTime: 10_000, // 10s — auditoria é "verdade no momento", não cacheia muito
    retry: 1,
  });
}
