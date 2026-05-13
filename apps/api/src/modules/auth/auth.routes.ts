/**
 * Routes do Auth.
 *
 * /login e /refresh tem rate limit agressivo (10/min por IP).
 * /me e /change-password exigem token de acesso.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '@config/env';
import { validate } from '@shared/middlewares/validation.middleware';
import { authController } from './auth.controller';
import { authenticate } from './auth.middleware';
import { changePasswordSchema, loginSchema } from './auth.dto';

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: true, mensagem: 'Muitas tentativas', codigo: 'RATE_LIMIT' },
});

export const authRoutes = Router();

authRoutes.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRoutes.post('/refresh', authLimiter, authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authenticate, authController.me);
authRoutes.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
