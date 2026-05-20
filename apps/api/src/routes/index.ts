/**
 * Composição final das rotas da API.
 *
 * Cada módulo expõe seu próprio Router; aqui apenas montamos no path
 * apropriado. Prefixo /api/v1 permite evoluir contratos sem quebrar
 * clients antigos.
 */
import { Router } from 'express';
import { healthRoutes, versionRoutes } from '@modules/health/health.routes';
import { templateRoutes } from '@modules/_template/_template.routes';
import { authRoutes } from '@modules/auth/auth.routes';
import { notificacaoRoutes } from '@modules/notificacao/notificacao.routes';
import { notaRoutes } from '@modules/nota/nota.routes';
import { demandaRoutes } from '@modules/demanda/demanda.routes';
import { auditoriaRoutes } from '@modules/auditoria/auditoria.routes';
import { usuariosRoutes } from '@modules/usuarios/usuarios.routes';
import { lembreteRoutes } from '@modules/lembretes/lembrete.routes';
import { telegramRoutes } from '@modules/telegram/telegram.routes';
import { env } from '@config/env';
// docs.routes eh importado LAZY abaixo pra nao puxar @asteasolutions/zod-to-openapi
// quando OPENAPI_ENABLED=false (carregar o modulo crasha em algumas versoes de Zod).

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
v1.use('/lembretes', lembreteRoutes);
v1.use('/telegram', telegramRoutes);
v1.use('/version', versionRoutes);

// Documentação OpenAPI + Swagger UI — desabilitar via OPENAPI_ENABLED=false.
// Import lazy: so carrega quando ENABLED (evita crash de zod-to-openapi em prod).
if (env.OPENAPI_ENABLED) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { docsRoutes } = require('./docs.routes');
  v1.use('/docs', docsRoutes);
}

apiRouter.use('/api/v1', v1);
