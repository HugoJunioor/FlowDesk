import type { Request, Response, NextFunction } from 'express';
import { auditoriaService } from './auditoria.service';
import type { ListAuditoriaQuery } from './auditoria.dto';

export const auditoriaController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListAuditoriaQuery;
      const result = await auditoriaService.list(query);
      res.json({ sucesso: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};
