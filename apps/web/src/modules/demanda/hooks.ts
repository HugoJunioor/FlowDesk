/**
 * Hooks React Query do módulo Demanda.
 */
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { demandaApi } from './api';
import type {
  AddReplyInput, CreateInfraInput, Demanda, DemandaPaginated, DemandaQuery, ThreadReply,
} from './types';

const QK = {
  list: (q: DemandaQuery) => ['demandas', 'list', q] as const,
  one: (id: string) => ['demandas', 'one', id] as const,
  replies: (id: string) => ['demandas', id, 'replies'] as const,
};

export function useDemandas(query: DemandaQuery, opts: { enabled?: boolean } = {}) {
  return useQuery<DemandaPaginated, Error>({
    queryKey: QK.list(query),
    queryFn: () => demandaApi.list(query),
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useDemanda(id: string | undefined) {
  return useQuery<Demanda, Error>({
    queryKey: id ? QK.one(id) : ['demandas', 'one', 'undefined'],
    queryFn: () => demandaApi.findOne(id as string),
    enabled: !!id,
    retry: 1,
  });
}

export function useCreateInfraDemanda() {
  const qc = useQueryClient();
  return useMutation<Demanda, Error, CreateInfraInput>({
    mutationFn: (input) => demandaApi.createInfra(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['demandas'] }),
  });
}

export function useAtenderDemanda() {
  const qc = useQueryClient();
  return useMutation<Demanda, Error, string>({
    mutationFn: (id) => demandaApi.atender(id),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['demandas'] });
      qc.setQueryData(QK.one(data.id), data);
    },
  });
}

export function useConcluirDemanda() {
  const qc = useQueryClient();
  return useMutation<Demanda, Error, string>({
    mutationFn: (id) => demandaApi.concluir(id),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['demandas'] });
      qc.setQueryData(QK.one(data.id), data);
    },
  });
}

export function useRemoveDemanda() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => demandaApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['demandas'] }),
  });
}

// ===== Thread replies =====

export function useThreadReplies(id: string | undefined) {
  return useQuery<ThreadReply[], Error>({
    queryKey: id ? QK.replies(id) : ['demandas', 'undefined', 'replies'],
    queryFn: () => demandaApi.listReplies(id as string),
    enabled: !!id,
    retry: 1,
  });
}

export function useAddReply(demandaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<ThreadReply, Error, AddReplyInput>({
    mutationFn: (input) => demandaApi.addReply(demandaId as string, input),
    onSuccess: () => {
      if (demandaId) {
        void qc.invalidateQueries({ queryKey: QK.replies(demandaId) });
        void qc.invalidateQueries({ queryKey: QK.one(demandaId) });
      }
    },
  });
}
