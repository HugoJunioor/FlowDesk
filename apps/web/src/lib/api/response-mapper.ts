/**
 * Helper pra desempacotar o envelope padronizado da API.
 *
 * Sucesso: { sucesso: true, dados }
 * Lista paginada: { sucesso: true, dados, total, pagina, limite, totalPaginas }
 * Erro: { erro: true, mensagem, codigo, detalhes?, requestId }
 *
 * Como o axios interceptor ja propaga erros (status >= 400 vira reject),
 * aqui só precisamos extrair `dados` ou retornar a lista paginada inteira.
 */
import type { AxiosResponse } from 'axios';

export interface ApiSuccessEnvelope<T> {
  sucesso: true;
  dados: T;
}

export interface ApiPaginatedEnvelope<T> {
  sucesso: true;
  dados: T[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiPaginatedEnvelope<T>;

/**
 * Extrai apenas o campo `dados`. Use pra respostas que retornam objeto único
 * ou quando você só quer a lista (sem paginação).
 */
export function unwrap<T>(res: AxiosResponse<ApiResponse<T>>): T {
  const body = res.data;
  if (!body || !('sucesso' in body) || !body.sucesso) {
    throw new Error('Resposta inesperada do servidor');
  }
  return (body as ApiSuccessEnvelope<T>).dados;
}

/**
 * Retorna o envelope paginado completo (dados + total + pagina + limite +
 * totalPaginas). Use em listas.
 */
export function unwrapPaginated<T>(
  res: AxiosResponse<ApiPaginatedEnvelope<T>>,
): ApiPaginatedEnvelope<T> {
  const body = res.data;
  if (!body || !body.sucesso) {
    throw new Error('Resposta inesperada do servidor');
  }
  return body;
}
