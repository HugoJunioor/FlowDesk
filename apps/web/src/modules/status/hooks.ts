/**
 * Hook do health check com polling.
 */
import { useQuery } from '@tanstack/react-query';
import { statusApi } from './api';
import type { ApiHealth } from './types';

export function useApiHealth(opts: { refetchInterval?: number } = {}) {
  return useQuery<ApiHealth, Error>({
    queryKey: ['status', 'api-health'],
    queryFn: () => statusApi.getHealth(),
    refetchInterval: opts.refetchInterval ?? 30_000,
    retry: 0,
    staleTime: 0,
  });
}
