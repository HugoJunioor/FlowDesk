/**
 * Rotas do módulo lembretes.
 *
 * POST /trigger-manual — dispara ciclo agora (master only, para testes)
 */
import { Router } from 'express';
import { authenticate, requirePerfil } from '@modules/auth/auth.middleware';
import { lembreteController } from './lembrete.controller';

export const lembreteRoutes = Router();

lembreteRoutes.post(
  '/trigger-manual',
  authenticate,
  requirePerfil('master'),
  lembreteController.triggerManual,
);
