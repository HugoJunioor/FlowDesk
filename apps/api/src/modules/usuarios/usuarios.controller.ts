/**
 * Controller do módulo Usuarios.
 *
 * GET    /api/v1/usuarios              — lista todos (master only)
 * POST   /api/v1/usuarios              — cria usuário (master only)
 * PUT    /api/v1/usuarios/:id          — edita nome/perfil/status (master only)
 * DELETE /api/v1/usuarios/:id          — soft-delete (master only, não-master)
 * POST   /api/v1/usuarios/:id/reset-password — gera senha temporária (master only)
 * DELETE /api/v1/usuarios/:id/lgpd    — anonimização LGPD (master only)
 */
import type { Request, Response, NextFunction } from 'express';
import { auditService } from '@shared/audit/audit.service';
import { usuariosService } from './usuarios.service';
import type { CreateUsuarioInput, UpdateUsuarioInput, UpdateMyPreferencesInput } from './usuarios.service';

export const usuariosController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dados = await usuariosService.list();
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as CreateUsuarioInput;
      const { usuario, senhaTempOraria } = await usuariosService.create(input);

      auditService.log({
        req,
        recurso: 'usuario',
        recursoId: usuario.id,
        acao: 'create',
        payloadDepois: { login: usuario.login, email: usuario.email, perfil: usuario.perfil },
      });

      res.status(201).json({ sucesso: true, dados: { usuario, senhaTempOraria } });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const input = req.body as UpdateUsuarioInput;
      const dados = await usuariosService.update(id, input, req.user!.id);

      auditService.log({
        req,
        recurso: 'usuario',
        recursoId: id,
        acao: 'update',
        payloadDepois: input,
      });

      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      await usuariosService.delete(id, req.user!.id);

      auditService.log({
        req,
        recurso: 'usuario',
        recursoId: id,
        acao: 'delete',
      });

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const dados = await usuariosService.resetPassword(id);

      auditService.log({
        req,
        recurso: 'usuario',
        recursoId: id,
        acao: 'reset_password',
      });

      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async updateMyPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as UpdateMyPreferencesInput;
      const dados = await usuariosService.updateMyPreferences(req.user!.id, input);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async anonimizarLgpd(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const resultado = await usuariosService.anonimizarLgpd(
        id,
        req.user!.id,
      );

      auditService.log({
        req,
        recurso: 'usuario',
        recursoId: id,
        acao: 'anonimize_lgpd',
        payloadDepois: { anonimizadoEm: resultado.anonimizadoEm },
      });

      res.json({ sucesso: true, dados: resultado });
    } catch (err) {
      next(err);
    }
  },
};
