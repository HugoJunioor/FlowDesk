/**
 * Routes do módulo Usuarios.
 *
 * Todos os endpoints exigem autenticação + perfil master.
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

const createBodySchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().email('E-mail inválido').toLowerCase(),
  perfil: z.enum(['master', 'user']),
});

const updateBodySchema = z.object({
  nome: z.string().trim().min(2).max(100).optional(),
  perfil: z.enum(['master', 'user']).optional(),
  status: z.enum(['active', 'blocked']).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Informe ao menos um campo para atualizar' });

export const usuariosRoutes = Router();

// All routes require authenticated master
usuariosRoutes.use(authenticate, requirePerfil('master'));

usuariosRoutes.get('/', usuariosController.list);

usuariosRoutes.post(
  '/',
  validate({ body: createBodySchema }),
  usuariosController.create,
);

usuariosRoutes.put(
  '/:id',
  validate({ params: idParamSchema, body: updateBodySchema }),
  usuariosController.update,
);

usuariosRoutes.delete(
  '/:id',
  validate({ params: idParamSchema }),
  usuariosController.delete,
);

usuariosRoutes.post(
  '/:id/reset-password',
  validate({ params: idParamSchema }),
  usuariosController.resetPassword,
);

usuariosRoutes.delete(
  '/:id/lgpd',
  validate({ params: idParamSchema }),
  usuariosController.anonimizarLgpd,
);
