/**
 * Routes da auditoria — leitura restrita a master.
 *
 * Endpoint sensivel: expõe a trilha completa. So master pode acessar.
 */
import { Router } from 'express';
import { validate } from '@shared/middlewares/validation.middleware';
import { authenticate, requirePerfil } from '@modules/auth/auth.middleware';
import { auditoriaController } from './auditoria.controller';
import { listAuditoriaQuerySchema } from './auditoria.dto';

export const auditoriaRoutes = Router();

auditoriaRoutes.use(authenticate);
auditoriaRoutes.use(requirePerfil('master'));

auditoriaRoutes.get(
  '/',
  validate({ query: listAuditoriaQuerySchema }),
  auditoriaController.list,
);
