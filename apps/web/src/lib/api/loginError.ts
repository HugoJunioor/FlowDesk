/**
 * Traduz a falha de login numa mensagem que diz a verdade.
 *
 * Antes, tudo que não fosse 429 ou 403 virava "Usuário ou senha inválidos" —
 * incluindo timeout, servidor fora do ar, 502 do proxy e erro de rede. Isso
 * tem dois custos concretos:
 *
 *  - o usuário tenta de novo achando que errou a senha, e queima o lockout de
 *    5 tentativas / 15 min do backend (auth.service.ts);
 *  - quem for investigar começa procurando no lugar errado. Uma falha de
 *    infraestrutura ficou dias parecendo senha errada.
 *
 * Separar por causa não vaza nada: o atacante já sabe se o servidor respondeu.
 * O que não pode é distinguir "usuário não existe" de "senha errada" — e isso
 * continua igual, ambos são 401 com a mesma frase.
 */
import { ApiError } from './client';

export const CREDENCIAL_INVALIDA = 'Usuário ou senha inválidos';

export function describeLoginFailure(err: ApiError): string {
  switch (err.kind) {
    case 'timeout':
      return 'O servidor demorou demais para responder. Sua senha não foi recusada — tente novamente em instantes.';
    case 'network':
      return 'Não foi possível falar com o servidor. Verifique sua conexão (ou a VPN) e tente de novo.';
    case 'unknown':
      return 'Falha inesperada ao entrar. Tente novamente.';
  }

  if (err.status === 429) {
    return 'Muitas tentativas. Aguarde e tente novamente.';
  }
  if (err.status === 403) {
    // O backend manda aqui tanto conta bloqueada quanto lockout por tentativas,
    // e a mensagem dele já diz qual é.
    return err.message || 'Conta bloqueada. Contate o administrador.';
  }
  if (err.status >= 500) {
    return 'O servidor falhou ao processar o login. Sua senha não foi recusada — avise o suporte se continuar.';
  }
  if (err.status === 401) {
    return CREDENCIAL_INVALIDA;
  }
  // Status inesperado com resposta: não afirme que a credencial está errada.
  return err.message || 'Não foi possível entrar. Tente novamente.';
}
