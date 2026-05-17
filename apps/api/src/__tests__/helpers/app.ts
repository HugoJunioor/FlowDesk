/**
 * Helper para criar instância Express nos testes de integração/rota.
 *
 * Monta o app sem as rotas de docs (que dependem de zod-to-openapi com
 * registro global) e sem o módulo slack (ainda não existe).
 * Os módulos de negócio são todos incluídos — testamos o comportamento real
 * das rotas com services mockados.
 */
import express, { type Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { errorHandler } from '@shared/middlewares/error-handler.middleware';
import { requestId } from '@shared/middlewares/request-id.middleware';
import { authRoutes } from '@modules/auth/auth.routes';
import { demandaRoutes } from '@modules/demanda/demanda.routes';
import { auditoriaRoutes } from '@modules/auditoria/auditoria.routes';
import { notificacaoRoutes } from '@modules/notificacao/notificacao.routes';

export function createTestApp(): Express {
  const app = express();

  app.use(requestId);
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/demandas', demandaRoutes);
  app.use('/api/v1/auditoria', auditoriaRoutes);
  app.use('/api/v1/notificacoes', notificacaoRoutes);

  app.use((req, res) => {
    res.status(404).json({ erro: true, mensagem: 'Not found', codigo: 'ROTA_NAO_ENCONTRADA' });
  });

  app.use(errorHandler);

  return app;
}
