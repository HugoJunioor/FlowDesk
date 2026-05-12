/**
 * Routes do módulo Template — composição de middlewares + controllers.
 *
 * Estrutura recomendada para cada rota:
 *   1. Validação Zod (validate({body|query|params}))
 *   2. Auth (se aplicável)
 *   3. Permissão (se aplicável)
 *   4. Controller
 */
import { Router } from 'express';
import { validate } from '@shared/middlewares/validation.middleware';
import { templateController } from './_template.controller';
import {
  createTemplateSchema,
  idParamSchema,
  listTemplateQuerySchema,
  updateTemplateSchema,
} from './_template.dto';

export const templateRoutes = Router();

templateRoutes.get(
  '/',
  validate({ query: listTemplateQuerySchema }),
  templateController.list,
);

templateRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  templateController.getById,
);

templateRoutes.post(
  '/',
  validate({ body: createTemplateSchema }),
  templateController.create,
);

templateRoutes.put(
  '/:id',
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  templateController.update,
);

templateRoutes.delete(
  '/:id',
  validate({ params: idParamSchema }),
  templateController.remove,
);
