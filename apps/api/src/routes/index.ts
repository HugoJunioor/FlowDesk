/**
 * Composição final das rotas da API.
 *
 * Cada módulo expõe seu próprio Router; aqui apenas montamos no path
 * apropriado. Prefixo /api/v1 permite evoluir contratos sem quebrar
 * clients antigos.
 */
import { Router } from 'express';
import { healthRoutes } from '@modules/health/health.routes';
import { templateRoutes } from '@modules/_template/_template.routes';
import { authRoutes } from '@modules/auth/auth.routes';
import { notificacaoRoutes } from '@modules/notificacao/notificacao.routes';
import { notaRoutes } from '@modules/nota/nota.routes';
import { demandaRoutes } from '@modules/demanda/demanda.routes';
import { auditoriaRoutes } from '@modules/auditoria/auditoria.routes';
import { usuariosRoutes } from '@modules/usuarios/usuarios.routes';
import { env } from '@config/env';
import { docsRoutes } from './docs.routes';
import { slackRoutes } from '@modules/slack/slack.routes';

export const apiRouter = Router();

// Health não tem prefixo de versão — sempre na raiz.
apiRouter.use('/health', healthRoutes);
apiRouter.use('/healthz', healthRoutes); // alias k8s

// Modulos de negocio sob /api/v1
const v1 = Router();
v1.use('/auth', authRoutes);
v1.use('/notificacoes', notificacaoRoutes);
v1.use('/notas', notaRoutes);
v1.use('/demandas', demandaRoutes);
v1.use('/auditoria', auditoriaRoutes);
v1.use('/usuarios', usuariosRoutes);
v1.use('/templates', templateRoutes);

// Slack Events API webhook — habilitar via SLACK_WEBHOOK_ENABLED=true
// Rota publica (sem JWT), protegida por assinatura HMAC no middleware.
if (env.SLACK_WEBHOOK_ENABLED) {
  v1.use('/slack', slackRoutes);
}

// Documentação OpenAPI + Swagger UI — desabilitar via OPENAPI_ENABLED=false
if (env.OPENAPI_ENABLED) {
  v1.use('/docs', docsRoutes);
}

apiRouter.use('/api/v1', v1);
