/**
 * Routes de demandas (consolidado Slack + Infra).
 */
import { Router } from 'express';
import { validate } from '@shared/middlewares/validation.middleware';
import { authenticate } from '@modules/auth/auth.middleware';
import { demandaController } from './demanda.controller';
import {
  createInfraSchema,
  idParamSchema,
  listDemandaQuerySchema,
  updateDemandaSchema,
} from './demanda.dto';

export const demandaRoutes = Router();

demandaRoutes.use(authenticate);

demandaRoutes.get('/', validate({ query: listDemandaQuerySchema }), demandaController.list);
demandaRoutes.get('/:id', validate({ params: idParamSchema }), demandaController.getById);

// Cria demanda Infra (sempre origem=internal)
demandaRoutes.post(
  '/infra',
  validate({ body: createInfraSchema }),
  demandaController.createInfra,
);

demandaRoutes.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateDemandaSchema }),
  demandaController.update,
);

// Actions
demandaRoutes.post(
  '/:id/atender',
  validate({ params: idParamSchema }),
  demandaController.atender,
);
demandaRoutes.post(
  '/:id/concluir',
  validate({ params: idParamSchema }),
  demandaController.concluir,
);

demandaRoutes.delete('/:id', validate({ params: idParamSchema }), demandaController.remove);
