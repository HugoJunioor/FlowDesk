/**
 * Hooks React Query do módulo Auth.
 *
 * Padrão Just:
 * - useQuery pra leituras (cache, refetch)
 * - useMutation pra ações
 * - chave de query inclui o módulo: ['auth', 'me']
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';
import type { AuthenticatedUser, AuthResponse } from './types';

const QK = {
  me: ['auth', 'me'] as const,
};

export function useMe(opts: { enabled?: boolean } = {}) {
  return useQuery<AuthenticatedUser, Error>({
    queryKey: QK.me,
    queryFn: () => authApi.me(),
    enabled: opts.enabled ?? true,
    // Não retenta em 401 (interceptor já lida)
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<AuthResponse, Error, { login: string; senha: string }>({
    mutationFn: (payload) => authApi.login(payload),
    onSuccess: (data) => {
      qc.setQueryData(QK.me, data.usuario);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      qc.removeQueries({ queryKey: ['auth'] });
      qc.clear(); // limpa todas as caches no logout
    },
  });
}

export function useChangePassword() {
  return useMutation<void, Error, { senhaAtual: string; novaSenha: string }>({
    mutationFn: (payload) => authApi.changePassword(payload),
  });
}
