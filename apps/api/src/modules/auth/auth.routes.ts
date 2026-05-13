/**
 * Routes do Auth.
 *
 * /login tem rate limit por IP: 20 req/min. IPs bloqueados são logados
 * com hash SHA-256 truncado (LGPD — não expor IP em logs estruturados).
 * /refresh compartilha o mesmo limiter.
 * /me e /change-password exigem token de acesso.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';
import { validate } from '@shared/middlewares/validation.middleware';
import { authController } from './auth.controller';
import { authenticate } from './auth.middleware';
import { changePasswordSchema, loginSchema } from './auth.dto';

/** Hash SHA-256 truncado a 16 chars — rastreável internamente, não é PII. */
function hashIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

const LOGIN_RATE_LIMIT = 20;

const loginIpLimiter = rateLimit({
  windowMs: 60_000,
  limit: LOGIN_RATE_LIMIT,
  standardHeaders: true, // envia RateLimit-* headers (inclui Retry-After via reset)
  legacyHeaders: false,
  handler(req, res) {
    const retryAfter = Math.ceil(
      (res.getHeader('RateLimit-Reset') as number ?? 60),
    );
    logger.warn(
      { ipHash: hashIp(req.ip), path: req.path },
      'rate_limit_triggered: login IP bloqueado',
    );
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ erro: true, mensagem: 'Muitas tentativas', codigo: 'RATE_LIMIT' });
  },
});

// Limiter mais permissivo p/ demais endpoints de auth (refresh, logout…)
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: true, mensagem: 'Muitas tentativas', codigo: 'RATE_LIMIT' },
});

export const authRoutes = Router();

authRoutes.post('/login', loginIpLimiter, validate({ body: loginSchema }), authController.login);
authRoutes.post('/refresh', authLimiter, authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authenticate, authController.me);
authRoutes.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
