/**
 * Hooks React Query do módulo Nota.
 *
 * Cache key sempre prefixado com ['notas']. Mutations invalidam a
 * lista pra refetch automatico.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notaApi } from './api';
import type { CreateNotaInput, Nota, UpdateNotaInput } from './types';

const QK = {
  list: ['notas', 'list'] as const,
  one: (id: string) => ['notas', 'one', id] as const,
};

export function useNotas(opts: { enabled?: boolean } = {}) {
  return useQuery<Nota[], Error>({
    queryKey: QK.list,
    queryFn: () => notaApi.list(),
    enabled: opts.enabled ?? true,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useNota(id: string | undefined) {
  return useQuery<Nota, Error>({
    queryKey: id ? QK.one(id) : ['notas', 'one', 'undefined'],
    queryFn: () => notaApi.findOne(id as string),
    enabled: !!id,
    retry: 1,
  });
}

export function useCreateNota() {
  const qc = useQueryClient();
  return useMutation<Nota, Error, CreateNotaInput>({
    mutationFn: (input) => notaApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.list });
    },
  });
}

export function useUpdateNota() {
  const qc = useQueryClient();
  return useMutation<Nota, Error, { id: string; input: UpdateNotaInput }>({
    mutationFn: ({ id, input }) => notaApi.update(id, input),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: QK.list });
      qc.setQueryData(QK.one(data.id), data);
    },
  });
}

export function useRemoveNota() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => notaApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.list });
    },
  });
}
