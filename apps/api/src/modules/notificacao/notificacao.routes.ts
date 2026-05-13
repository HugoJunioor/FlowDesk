/**
 * Routes de notificações — todas autenticadas.
 *
 * GET    /                  lista do user logado
 * POST   /                  cria (interno)
 * PATCH  /:id               marca lida/nao lida
 * POST   /mark-all-read     marca todas do user como lidas
 * GET    /preferences       prefs do user
 * PUT    /preferences       upsert prefs
 */
import { Router } from 'express';
import { validate } from '@shared/middlewares/validation.middleware';
import { authenticate } from '@modules/auth/auth.middleware';
import { notificacaoController } from './notificacao.controller';
import {
  createNotificacaoSchema,
  idParamSchema,
  patchNotificacaoSchema,
  preferenciaSchema,
} from './notificacao.dto';

export const notificacaoRoutes = Router();

notificacaoRoutes.use(authenticate);

notificacaoRoutes.get('/', notificacaoController.list);

notificacaoRoutes.post(
  '/',
  validate({ body: createNotificacaoSchema }),
  notificacaoController.create,
);

// Importante: rota mais específica (/mark-all-read) ANTES de /:id
notificacaoRoutes.post('/mark-all-read', notificacaoController.markAllRead);

notificacaoRoutes.get('/preferences', notificacaoController.getPreferencia);

notificacaoRoutes.put(
  '/preferences',
  validate({ body: preferenciaSchema }),
  notificacaoController.savePreferencia,
);

notificacaoRoutes.patch(
  '/:id',
  validate({ params: idParamSchema, body: patchNotificacaoSchema }),
  notificacaoController.markRead,
);
