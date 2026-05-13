/**
 * Hooks React Query do módulo Notificacao.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificacaoApi } from './api';
import type { Notificacao, Preferencia, PreferenciaInput } from './types';

const QK = {
  list: ['notificacoes', 'list'] as const,
  prefs: ['notificacoes', 'preferences'] as const,
};

export function useNotificacoes(opts: {
  enabled?: boolean;
  refetchInterval?: number;
} = {}) {
  return useQuery<Notificacao[], Error>({
    queryKey: QK.list,
    queryFn: () => notificacaoApi.list(),
    enabled: opts.enabled ?? true,
    refetchInterval: opts.refetchInterval ?? false,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<Notificacao, Error, { id: string; lida: boolean }>({
    mutationFn: ({ id, lida }) => notificacaoApi.markRead(id, lida),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK.list }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation<{ count: number }, Error, void>({
    mutationFn: () => notificacaoApi.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK.list }),
  });
}

export function usePreferencia() {
  return useQuery<Preferencia, Error>({
    queryKey: QK.prefs,
    queryFn: () => notificacaoApi.getPreferencia(),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useSavePreferencia() {
  const qc = useQueryClient();
  return useMutation<Preferencia, Error, PreferenciaInput>({
    mutationFn: (input) => notificacaoApi.savePreferencia(input),
    onSuccess: (data) => qc.setQueryData(QK.prefs, data),
  });
}
