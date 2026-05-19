/**
 * Controller do módulo lembretes.
 * Apenas endpoint de trigger manual (master only).
 */
import type { Request, Response, NextFunction } from 'express';
import { triggerManual } from './lembrete.cron';

export const lembreteController = {
  async triggerManual(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await triggerManual();
      res.json({ sucesso: true, dados: result });
    } catch (err) {
      next(err);
    }
  },
};
