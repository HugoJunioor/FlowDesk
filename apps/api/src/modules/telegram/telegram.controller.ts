/**
 * Controller do módulo Telegram.
 *
 * Todos os endpoints autenticados exigem req.user (via authenticate).
 * O webhook é público mas validado por secret no path.
 */
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@shared/domain/errors';
import { logger } from '@shared/logging/logger';
import { telegramService } from './telegram.service';
import { telegramUpdateSchema } from './telegram.schemas';

function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const telegramController = {
  async startLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const dados = await telegramService.startLink(user.email);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async cancelLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      telegramService.cancelLink(user.email);
      res.json({ sucesso: true });
    } catch (err) {
      next(err);
    }
  },

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      await telegramService.disconnect(user.email);
      res.json({ sucesso: true });
    } catch (err) {
      next(err);
    }
  },

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const dados = await telegramService.getStatus(user.email);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = telegramUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        // Telegram não requer resposta específica — 200 silencia retries
        res.status(200).json({ ok: true });
        return;
      }

      // Processa em background — retorna 200 imediatamente (Telegram tem timeout curto)
      void telegramService.processWebhookUpdate(parsed.data).catch((err) => {
        logger.error({ err }, 'telegram: erro ao processar webhook update');
      });

      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
};
