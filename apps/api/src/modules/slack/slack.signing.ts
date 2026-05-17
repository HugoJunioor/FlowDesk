/**
 * Validação de assinatura Slack (HMAC SHA256).
 *
 * Referência: https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * O Slack assina toda requisição com:
 *   X-Slack-Signature: v0=<hmac_hex>
 *   X-Slack-Request-Timestamp: <unix_seconds>
 *
 * Prevenção de replay: rejeita requests com timestamp > 5 min.
 */
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/logging/logger';

const SLACK_VERSION = 'v0';
const MAX_AGE_SECONDS = 60 * 5;

/**
 * Middleware que valida a assinatura Slack antes de chegar no controller.
 * Exige `SLACK_SIGNING_SECRET` no env e que o body raw esteja disponível
 * em `req.rawBody` (Buffer).
 *
 * Se `SLACK_SIGNING_SECRET` não estiver configurado, bloqueia em produção
 * e deixa passar em outros ambientes (facilita testes locais).
 */
export function verifySlackSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.SLACK_SIGNING_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('SLACK_SIGNING_SECRET ausente em producao — bloqueando request');
      res.status(403).json({ sucesso: false, erro: 'Assinatura nao configurada' });
      return;
    }
    // Dev/test sem secret: passa direto (avisa no log)
    logger.warn('SLACK_SIGNING_SECRET nao configurado — pulando validacao de assinatura (nao-producao)');
    next();
    return;
  }

  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
  const signature = req.headers['x-slack-signature'] as string | undefined;

  if (!timestamp || !signature) {
    logger.warn({ path: req.path }, 'Slack request sem headers de assinatura');
    res.status(400).json({ sucesso: false, erro: 'Headers de assinatura ausentes' });
    return;
  }

  // Proteção anti-replay
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_AGE_SECONDS) {
    logger.warn({ timestamp, now }, 'Slack request com timestamp expirado');
    res.status(400).json({ sucesso: false, erro: 'Request expirado' });
    return;
  }

  // rawBody precisa ser populado pelo express antes desse middleware.
  // Usamos req.body serializado como fallback se rawBody nao estiver disponível.
  const rawBody: string =
    (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ??
    JSON.stringify(req.body);

  const baseString = `${SLACK_VERSION}:${timestamp}:${rawBody}`;
  const expected =
    `${SLACK_VERSION}=` +
    crypto.createHmac('sha256', secret).update(baseString, 'utf8').digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expBuffer)
  ) {
    logger.warn({ path: req.path }, 'Assinatura Slack invalida');
    res.status(403).json({ sucesso: false, erro: 'Assinatura invalida' });
    return;
  }

  next();
}
