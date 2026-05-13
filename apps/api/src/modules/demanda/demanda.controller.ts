/**
 * Controller de demandas.
 */
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@shared/domain/errors';
import { demandaService } from './demanda.service';
import type {
  CreateInfraInput,
  IdParam,
  ListDemandaQuery,
  UpdateDemandaInput,
} from './demanda.dto';

function actorFromReq(req: Request): {
  nome: string;
  email: string;
  perfil: 'master' | 'user';
} {
  if (!req.user) throw new UnauthorizedError();
  return {
    nome: req.user.nome,
    email: req.user.email,
    perfil: req.user.perfil,
  };
}

export const demandaController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListDemandaQuery;
      const result = await demandaService.list(query);
      res.json({ sucesso: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const dados = await demandaService.findById(id);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async createInfra(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = actorFromReq(req);
      const input = req.body as CreateInfraInput;
      const dados = await demandaService.createInfra(input, actor);
      res.status(201).json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = actorFromReq(req);
      const { id } = req.params as unknown as IdParam;
      const input = req.body as UpdateDemandaInput;
      const dados = await demandaService.update(id, input, actor);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async atender(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = actorFromReq(req);
      const { id } = req.params as unknown as IdParam;
      const dados = await demandaService.atender(id, actor);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async concluir(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = actorFromReq(req);
      const { id } = req.params as unknown as IdParam;
      const dados = await demandaService.concluir(id, actor);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = actorFromReq(req);
      const { id } = req.params as unknown as IdParam;
      await demandaService.remove(id, actor);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};
