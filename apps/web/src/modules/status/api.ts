/**
 * Health check da API. Endpoint /health fica FORA do prefixo /api/v1
 * (servido na raiz pra integrar com monitoring/k8s).
 *
 * Usamos axios direto em vez do apiClient porque a base de
 * apiClient eh /api/v1, mas /health esta na raiz.
 */
import axios from 'axios';
import type { ApiHealth } from './types';

// Sobe um nivel do baseURL — se VITE_API_URL=/api/v1, vamos pra /health
const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';
const HEALTH_URL = API_BASE.replace(/\/api\/v\d+\/?$/, '/health')
  || '/health';

export const statusApi = {
  async getHealth(): Promise<ApiHealth> {
    const res = await axios.get<{ sucesso: true; dados: ApiHealth }>(HEALTH_URL, {
      withCredentials: false,
      timeout: 5000,
    });
    return res.data.dados;
  },
};
