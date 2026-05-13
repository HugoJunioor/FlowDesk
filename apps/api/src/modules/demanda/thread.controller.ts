import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@shared/domain/errors';
import { threadService } from './thread.service';
import type { AddReplyInput, UpdateClosureInput } from './thread.dto';
import type { IdParam } from './demanda.dto';

function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const threadController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireUser(req);
      const { id } = req.params as unknown as IdParam;
      const dados = await threadService.list(id);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async add(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const { id } = req.params as unknown as IdParam;
      const input = req.body as AddReplyInput;
      const dados = await threadService.add(id, user.nome, input);
      res.status(201).json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async updateClosure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireUser(req);
      const { id } = req.params as unknown as IdParam;
      const input = req.body as UpdateClosureInput;
      const dados = await threadService.updateClosure(id, input);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },
};
