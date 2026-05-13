/**
 * Controller do módulo Template — adaptação HTTP ↔ service.
 *
 * Regras:
 *   - Try/catch + next(err) em toda action. NUNCA tratar erro aqui.
 *   - Resposta padronizada: { sucesso: true, dados } ou paginada.
 *   - Status code apropriado: 200 (GET/PUT), 201 (POST), 204 (DELETE).
 *
 * Nota: o middleware validate() ja parseou body/query/params com Zod
 * antes de chegar aqui. Tipagem narrow via generics do Express tem
 * limitacao com ParsedQs — preferimos cast simples + confianca no
 * middleware como fonte da verdade.
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
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListTemplateQuery;
      const result = await templateService.list(query);
      res.json({ sucesso: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const dados = await templateService.findById(id);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as CreateTemplateInput;
      const dados = await templateService.create(input);
      res.status(201).json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const input = req.body as UpdateTemplateInput;
      const dados = await templateService.update(id, input);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      await templateService.remove(id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};
