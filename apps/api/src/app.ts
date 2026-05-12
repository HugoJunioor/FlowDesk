/**
 * Aplicação Express — montagem de middlewares + rotas.
 *
 * Ordem importante:
 *   1. request-id (pra todo log ter rastreabilidade)
 *   2. helmet (security headers)
 *   3. cors (allowlist via env)
 *   4. compression
 *   5. body parsers
 *   6. cookie parser
 *   7. hpp (HTTP parameter pollution)
 *   8. pino-http (log estruturado por request)
 *   9. rate limit (geral; sensiveis tem proprio)
 *  10. routes
 *  11. 404 handler
 *  12. error handler global (SEMPRE por ultimo)
 */
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';

import { env } from '@config/env';
import { logger } from '@shared/logging/logger';
import { requestId } from '@shared/middlewares/request-id.middleware';
import { errorHandler } from '@shared/middlewares/error-handler.middleware';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  // 1. Request ID — sempre primeiro pra propagar no log
  app.use(requestId);

  // 2. Security headers
  app.use(helmet());

  // 3. CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`Origem nao permitida: ${origin}`));
      },
      credentials: true,
    }),
  );

  // 4. Compression
  app.use(compression());

  // 5. Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 6. Cookies (necessario pro refresh token HttpOnly da Fase 3)
  app.use(cookieParser());

  // 7. HPP — previne array injection em query strings
  app.use(hpp());

  // 8. Log estruturado por request, com X-Request-ID
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { id?: string }).id || 'unknown',
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req(req) {
          return { method: req.method, url: req.url };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  // 9. Rate limit geral (mais conservador). Rotas sensiveis tem proprio.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.RATE_LIMIT_READ,
      standardHeaders: true,
      legacyHeaders: false,
      message: { erro: true, mensagem: 'Muitas requisicoes', codigo: 'RATE_LIMIT' },
    }),
  );

  // 10. Routes
  app.use(apiRouter);

  // 11. 404 — qualquer rota não tratada
  app.use((req, res) => {
    res.status(404).json({
      erro: true,
      mensagem: `Rota nao encontrada: ${req.method} ${req.originalUrl}`,
      codigo: 'ROTA_NAO_ENCONTRADA',
      requestId: req.id,
    });
  });

  // 12. Error handler global (SEMPRE por ultimo)
  app.use(errorHandler);

  return app;
}
