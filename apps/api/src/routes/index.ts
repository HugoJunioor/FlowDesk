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

export const apiRouter = Router();

// Health não tem prefixo de versão — sempre na raiz.
apiRouter.use('/health', healthRoutes);
apiRouter.use('/healthz', healthRoutes); // alias k8s

// Modulos de negocio sob /api/v1
const v1 = Router();
v1.use('/auth', authRoutes);
v1.use('/notificacoes', notificacaoRoutes);
v1.use('/templates', templateRoutes);

apiRouter.use('/api/v1', v1);
