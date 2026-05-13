/**
 * Tipos internos do Auth.
 *
 * AuthenticatedRequest é declarado globalmente em express-serve-static-core
 * (augment) pra que `req.user` seja inferido em qualquer controller após
 * o auth.middleware.
 */
import type { AuthenticatedUser } from './auth.dto';

/** Payload assinado dentro do access token JWT. */
export interface JwtAccessPayload {
  sub: string; // user id
  login: string;
  perfil: 'master' | 'user';
  iat?: number;
  exp?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Setado pelo auth.middleware após validar o access token.
     * Não está disponível em rotas públicas.
     */
    user?: AuthenticatedUser;
  }
}
