/**
 * Routes do módulo Telegram.
 *
 * POST   /link/start      (auth) — gera linking code
 * POST   /link/cancel     (auth) — cancela code pendente
 * DELETE /link            (auth) — desconecta Telegram
 * GET    /status          (auth) — status de conexão
 * POST   /webhook/:secret (público) — recebe events do Bot
 *
 * Se TELEGRAM_ENABLED=false, todos os endpoints retornam 503.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { env } from '@config/env';
import { authenticate } from '@modules/auth/auth.middleware';
import { telegramController } from './telegram.controller';

export const telegramRoutes = Router();

function telegramDisabledHandler(_req: Request, res: Response): void {
  res.status(503).json({
    erro: true,
    mensagem: 'Integração com Telegram não está habilitada neste servidor.',
    codigo: 'TELEGRAM_DESABILITADO',
  });
}

function requireWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const { secret } = req.params as { secret: string };
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(403).json({ erro: true, mensagem: 'Forbidden', codigo: 'SEM_PERMISSAO' });
    return;
  }
  next();
}

if (!env.TELEGRAM_ENABLED) {
  // Módulo desabilitado — todos os endpoints retornam 503
  telegramRoutes.all('*', telegramDisabledHandler);
} else {
  // Endpoints autenticados
  telegramRoutes.post('/link/start', authenticate, telegramController.startLink);
  telegramRoutes.post('/link/cancel', authenticate, telegramController.cancelLink);
  telegramRoutes.delete('/link', authenticate, telegramController.disconnect);
  telegramRoutes.get('/status', authenticate, telegramController.getStatus);

  // Webhook público — validado por secret no path
  telegramRoutes.post('/webhook/:secret', requireWebhookSecret, telegramController.webhook);
}
