/**
 * Funções HTTP do módulo Demanda.
 */
import { apiClient } from '@/lib/api/client';
import { unwrap, unwrapPaginated } from '@/lib/api/response-mapper';
import type {
  AddReplyInput, CreateInfraInput, Demanda, DemandaPaginated, DemandaQuery, ThreadReply,
} from './types';

export const demandaApi = {
  async list(query: DemandaQuery = {}): Promise<DemandaPaginated> {
    const params = new URLSearchParams();
    if (query.pagina) params.set('pagina', String(query.pagina));
    if (query.limite) params.set('limite', String(query.limite));
    if (query.origem) params.set('origem', query.origem);
    if (query.status) params.set('status', query.status);
    if (query.prioridade) params.set('prioridade', query.prioridade);
    if (query.responsavel) params.set('responsavel', query.responsavel);
    if (query.busca) params.set('busca', query.busca);
    const qs = params.toString();
    const res = await apiClient.get(qs ? `/demandas?${qs}` : '/demandas');
    return unwrapPaginated(res as never) as unknown as DemandaPaginated;
  },

  async findOne(id: string): Promise<Demanda> {
    const res = await apiClient.get(`/demandas/${id}`);
    return unwrap<Demanda>(res);
  },

  async createInfra(input: CreateInfraInput): Promise<Demanda> {
    const res = await apiClient.post('/demandas/infra', input);
    return unwrap<Demanda>(res);
  },

  async atender(id: string): Promise<Demanda> {
    const res = await apiClient.post(`/demandas/${id}/atender`, {});
    return unwrap<Demanda>(res);
  },

  async concluir(id: string): Promise<Demanda> {
    const res = await apiClient.post(`/demandas/${id}/concluir`, {});
    return unwrap<Demanda>(res);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/demandas/${id}`);
  },

  // ===== Thread replies =====

  async listReplies(id: string): Promise<ThreadReply[]> {
    const res = await apiClient.get(`/demandas/${id}/replies`);
    return unwrap<ThreadReply[]>(res);
  },

  async addReply(id: string, input: AddReplyInput): Promise<ThreadReply> {
    const res = await apiClient.post(`/demandas/${id}/replies`, input);
    return unwrap<ThreadReply>(res);
  },
};
