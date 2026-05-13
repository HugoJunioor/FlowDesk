/**
 * Controller do módulo Usuarios.
 *
 * DELETE /api/v1/usuarios/:id/lgpd
 *   Anonimização LGPD (master only). Não deleta — substitui PII por dados
 *   anônimos, preservando o id para integridade referencial.
 */
import type { Request, Response, NextFunction } from 'express';
import { auditService } from '@shared/audit/audit.service';
import { usuariosService } from './usuarios.service';

export const usuariosController = {
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
