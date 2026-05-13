/**
 * Funções HTTP do módulo Nota — consome /api/v1/notas.
 *
 * Note: o backend extrai o user do JWT, então não precisamos passar
 * email em query string como o stateSync legacy fazia.
 */
import { apiClient } from '@/lib/api/client';
import { unwrap } from '@/lib/api/response-mapper';
import type { CreateNotaInput, Nota, UpdateNotaInput } from './types';

export const notaApi = {
  async list(): Promise<Nota[]> {
    const res = await apiClient.get('/notas');
    return unwrap<Nota[]>(res);
  },

  async findOne(id: string): Promise<Nota> {
    const res = await apiClient.get(`/notas/${id}`);
    return unwrap<Nota>(res);
  },

  async create(input: CreateNotaInput): Promise<Nota> {
    const res = await apiClient.post('/notas', input);
    return unwrap<Nota>(res);
  },

  async update(id: string, input: UpdateNotaInput): Promise<Nota> {
    const res = await apiClient.patch(`/notas/${id}`, input);
    return unwrap<Nota>(res);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/notas/${id}`);
  },
};
