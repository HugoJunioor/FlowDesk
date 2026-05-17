/**
 * Registro OpenAPI do módulo Health.
 *
 * Nota: health routes ficam em /health (sem /api/v1), mas documentamos
 * aqui com o path completo pra ficar claro no Swagger UI.
 * O servidor OpenAPI aponta para /api/v1, então adicionamos uma nota
 * na descrição de cada endpoint.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../registry';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Schemas registrados
// ---------------------------------------------------------------------------

const HealthSimpleSchema = registry.register(
  'HealthSimple',
  z.object({
    sucesso: z.literal(true),
    dados: z.object({
      status: z.literal('ok'),
      version: z.string().openapi({ example: '0.1.0' }),
      startedAt: z.string().datetime(),
      uptimeSeconds: z.number().int(),
    }),
  }).openapi('HealthSimple'),
);

const HealthDetailedSchema = registry.register(
  'HealthDetailed',
  z.object({
    sucesso: z.literal(true),
    dados: z.object({
      status: z.enum(['ok', 'degraded']),
      uptime: z.number().int(),
      version: z.string(),
      checks: z.object({
        database: z.object({
          ok: z.boolean(),
          latencyMs: z.number().int(),
          error: z.string().optional(),
        }),
        disk: z.object({
          ok: z.boolean(),
          freeGb: z.number(),
          error: z.string().optional(),
        }),
        memory: z.object({
          ok: z.boolean(),
          usedMb: z.number().int(),
          heapMb: z.number().int(),
        }),
      }),
    }),
  }).openapi('HealthDetailed'),
);

// ---------------------------------------------------------------------------
// Rotas (sem prefixo /api/v1 — montadas em /health)
// ---------------------------------------------------------------------------
// O gerador usa servers: [{ url: '/api/v1' }], então precisamos de paths
// relativos. Health está fora do prefixo v1, por isso documentamos com
// x-servers override ou simplesmente como nota na description.

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['health'],
  summary: 'Ping rápido (sem I/O)',
  description: 'Endpoint público sem autenticação. Path real: `GET /health` (fora do prefixo `/api/v1`).',
  responses: {
    200: {
      description: 'API no ar',
      content: { 'application/json': { schema: HealthSimpleSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health/detailed',
  tags: ['health'],
  summary: 'Health check detalhado (DB + disco + memória)',
  description: 'Checks de I/O com latência. Rate limitado a 30 req/min. Path real: `GET /health/detailed`.',
  responses: {
    200: {
      description: 'Status detalhado (200 mesmo degraded — checar campo `status`)',
      content: { 'application/json': { schema: HealthDetailedSchema } },
    },
    429: {
      description: 'Rate limit atingido',
      content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
    },
  },
});
