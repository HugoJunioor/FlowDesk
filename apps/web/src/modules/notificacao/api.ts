/**
 * Funções HTTP do módulo Notificacao.
 */
import { apiClient } from '@/lib/api/client';
import { unwrap } from '@/lib/api/response-mapper';
import type { Notificacao, Preferencia, PreferenciaInput } from './types';

export const notificacaoApi = {
  async list(): Promise<Notificacao[]> {
    const res = await apiClient.get('/notificacoes');
    return unwrap<Notificacao[]>(res);
  },

  async markRead(id: string, lida: boolean): Promise<Notificacao> {
    const res = await apiClient.patch(`/notificacoes/${id}`, { lida });
    return unwrap<Notificacao>(res);
  },

  async markAllRead(): Promise<{ count: number }> {
    const res = await apiClient.post('/notificacoes/mark-all-read', {});
    return unwrap<{ count: number }>(res);
  },

  async getPreferencia(): Promise<Preferencia> {
    const res = await apiClient.get('/notificacoes/preferences');
    return unwrap<Preferencia>(res);
  },

  async savePreferencia(input: PreferenciaInput): Promise<Preferencia> {
    const res = await apiClient.put('/notificacoes/preferences', input);
    return unwrap<Preferencia>(res);
  },
};
