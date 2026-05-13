/**
 * Routes do modulo Nota — todas autenticadas.
 *
 * GET    /          lista do user logado
 * GET    /:id       detalhe
 * POST   /          cria nota (com items embedded)
 * PATCH  /:id       atualiza (items substitui tudo se enviado)
 * DELETE /:id       soft delete
 */
import { Router } from 'express';
import { validate } from '@shared/middlewares/validation.middleware';
import { authenticate } from '@modules/auth/auth.middleware';
import { notaController } from './nota.controller';
import { createNotaSchema, idParamSchema, updateNotaSchema } from './nota.dto';

export const notaRoutes = Router();

notaRoutes.use(authenticate);

notaRoutes.get('/', notaController.list);
notaRoutes.get('/:id', validate({ params: idParamSchema }), notaController.getById);
notaRoutes.post('/', validate({ body: createNotaSchema }), notaController.create);
notaRoutes.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateNotaSchema }),
  notaController.update,
);
notaRoutes.delete('/:id', validate({ params: idParamSchema }), notaController.remove);
