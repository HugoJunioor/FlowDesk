/**
 * Middlewares de autenticação e autorização.
 *
 * - authenticate: valida JWT do header Authorization, popula req.user.
 *   Rotas que precisam de user logado usam isto.
 * - requirePerfil('master'): apenas master pode acessar.
 * - requirePermissao('modulo','acao'): valida na lista de permissões do user.
 *
 * Tudo retorna 401/403 com envelope padronizado de erro.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { UnauthorizedError, ForbiddenError } from '@shared/domain/errors';
import { authService } from './auth.service';
import type { JwtAccessPayload } from './auth.types';

function extractBearer(req: Request): string | null {
  const header = req.header('authorization') || req.header('Authorization');
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return m ? (m[1] ?? null) : null;
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedError('Token de acesso ausente');

    let payload: JwtAccessPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtAccessPayload;
    } catch {
      throw new UnauthorizedError('Token inválido ou expirado');
    }

    // Recupera dados frescos — evita confiar em payload stale após edição.
    const usuario = await authService.getMe(payload.sub);
    if (usuario.status === 'blocked') {
      throw new ForbiddenError('Conta bloqueada');
    }
    req.user = usuario;
    next();
  } catch (err) {
    next(err);
  }
};

export function requirePerfil(perfil: 'master' | 'user'): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    // Master tem acesso a tudo
    if (req.user.perfil === 'master') return next();
    if (req.user.perfil !== perfil) {
      return next(new ForbiddenError(`Acesso restrito a ${perfil}`));
    }
    next();
  };
}

export function requirePermissao(modulo: string, acao: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.perfil === 'master') return next(); // bypass
    const tem = req.user.permissoes.some((p) => p.modulo === modulo && p.acao === acao);
    if (!tem) {
      return next(new ForbiddenError(`Sem permissão: ${modulo}.${acao}`));
    }
    next();
  };
}
