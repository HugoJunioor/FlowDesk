/**
 * Routes do módulo Usuarios.
 *
 * DELETE /api/v1/usuarios/:id/lgpd  — anonimização LGPD (master only)
 */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@shared/middlewares/validation.middleware';
import { authenticate, requirePerfil } from '@modules/auth/auth.middleware';
import { usuariosController } from './usuarios.controller';

const idParamSchema = z.object({
  id: z.string().uuid({ message: 'id deve ser um UUID válido' }),
});

export const usuariosRoutes = Router();

usuariosRoutes.delete(
  '/:id/lgpd',
  authenticate,
  requirePerfil('master'),
  validate({ params: idParamSchema }),
  usuariosController.anonimizarLgpd,
);
