/**
 * Controller de notas. Todos endpoints exigem auth; email vem de req.user.
 */
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@shared/domain/errors';
import { notaService } from './nota.service';
import type { CreateNotaInput, IdParam, UpdateNotaInput } from './nota.dto';

function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const notaController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const dados = await notaService.listMine(user.email);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const { id } = req.params as unknown as IdParam;
      const dados = await notaService.findOne(id, user.email);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const input = req.body as CreateNotaInput;
      const dados = await notaService.create(user.email, input);
      res.status(201).json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const { id } = req.params as unknown as IdParam;
      const input = req.body as UpdateNotaInput;
      const dados = await notaService.update(id, user.email, input);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const { id } = req.params as unknown as IdParam;
      await notaService.remove(id, user.email);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};
