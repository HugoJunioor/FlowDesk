/**
 * Controller do módulo Template — adaptação HTTP ↔ service.
 *
 * Regras:
 *   - Try/catch + next(err) em toda action. NUNCA tratar erro aqui.
 *   - Resposta padronizada: { sucesso: true, dados } ou paginada.
 *   - Status code apropriado: 200 (GET/PUT), 201 (POST), 204 (DELETE).
 */
import type { Request, Response, NextFunction } from 'express';
import { templateService } from './_template.service';
import type {
  CreateTemplateInput,
  IdParam,
  ListTemplateQuery,
  UpdateTemplateInput,
} from './_template.dto';

export const templateController = {
  async list(
    req: Request<unknown, unknown, unknown, ListTemplateQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await templateService.list(req.query);
      res.json({ sucesso: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getById(
    req: Request<IdParam>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dados = await templateService.findById(req.params.id);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async create(
    req: Request<unknown, unknown, CreateTemplateInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dados = await templateService.create(req.body);
      res.status(201).json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async update(
    req: Request<IdParam, unknown, UpdateTemplateInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dados = await templateService.update(req.params.id, req.body);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async remove(
    req: Request<IdParam>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await templateService.remove(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};
