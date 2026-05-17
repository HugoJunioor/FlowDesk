/**
 * Rotas de documentação OpenAPI + Swagger UI.
 *
 * Montadas em /api/v1/docs.
 * Desabilitadas via OPENAPI_ENABLED=false (recomendado em prod).
 *
 * GET /api/v1/docs/openapi.json  — documento OpenAPI 3.1
 * GET /api/v1/docs               — Swagger UI
 */
import { Router, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiDocument } from '@shared/openapi/generate';

export const docsRoutes = Router();

// JSON do documento
docsRoutes.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(generateOpenApiDocument());
});

// Swagger UI — serve estáticos + HTML
docsRoutes.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerUrl: '/api/v1/docs/openapi.json',
    customSiteTitle: 'FlowDesk API Docs',
    swaggerOptions: {
      url: '/api/v1/docs/openapi.json',
      persistAuthorization: true,
    },
  }),
);
