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
 * Verifica se o body parseado bate com o envelope esperado.
 *
 * IMPORTANTE: o `'sucesso' in body` so eh seguro depois desse guard.
 * Sem ele, quando o backend devolve HTML (rota nao encontrada, gateway
 * timeout, container down) o `body` chega como string e o operador `in`
 * lanca TypeError com mensagem criptica:
 *   "Cannot use 'in' operator to search for 'sucesso' in <!doctype html>..."
 *
 * Esse helper troca o crash por um Error legivel que o consumidor
 * (React Query, error boundary) consegue formatar.
 */
function isApiEnvelope(body: unknown): body is { sucesso: boolean } {
  return typeof body === 'object' && body !== null && 'sucesso' in body;
}

/**
 * Extrai apenas o campo `dados`. Use pra respostas que retornam objeto único
 * ou quando você só quer a lista (sem paginação).
 */
export function unwrap<T>(res: AxiosResponse<ApiResponse<T>>): T {
  const body = res.data;
  if (!isApiEnvelope(body)) {
    // Recebeu HTML / texto puro / null — provavelmente rota nao roteada
    // (Traefik fallback pro front), container API down, ou login expirado
    // redirecionando pra pagina de login.
    throw new Error('Resposta inesperada do servidor (formato invalido)');
  }
  if (!body.sucesso) {
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
  if (!isApiEnvelope(body)) {
    throw new Error('Resposta inesperada do servidor (formato invalido)');
  }
  if (!body.sucesso) {
    throw new Error('Resposta inesperada do servidor');
  }
  return body as ApiPaginatedEnvelope<T>;
}
