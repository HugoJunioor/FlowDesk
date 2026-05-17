/**
 * Registro OpenAPI do módulo Auditoria.
 *
 * Schemas registrados. Rotas com TODO para expansão futura.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../registry';
import { listAuditoriaQuerySchema } from '@modules/auditoria/auditoria.dto';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Schemas registrados
// ---------------------------------------------------------------------------

const AuditoriaEntrySchema = registry.register(
  'AuditoriaEntry',
  z.object({
    id: z.string().uuid(),
    usuarioEmail: z.string().email().nullable(),
    recurso: z.string(),
    recursoId: z.string().nullable(),
    acao: z.string(),
    payloadAntes: z.unknown(),
    payloadDepois: z.unknown(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
    requestId: z.string().nullable(),
    criadoEm: z.string().datetime(),
  }).openapi('AuditoriaEntry'),
);

registry.register('ListAuditoriaQuery', listAuditoriaQuerySchema.openapi('ListAuditoriaQuery'));

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
// TODO: documentar rotas completas
// GET /auditoria — paginado, apenas master

registry.registerPath({
  method: 'get',
  path: '/auditoria',
  tags: ['auditoria'],
  summary: 'Lista trilha de auditoria (apenas perfil master)',
  security: [{ bearerAuth: [] }],
  request: { query: listAuditoriaQuerySchema },
  responses: {
    200: {
      description: 'Entradas de auditoria paginadas',
      content: {
        'application/json': {
          schema: z.object({
            sucesso: z.literal(true),
            dados: z.object({
              items: z.array(AuditoriaEntrySchema),
              total: z.number().int(),
              pagina: z.number().int(),
              limite: z.number().int(),
              totalPaginas: z.number().int(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Não autenticado',
      content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
    },
    403: {
      description: 'Acesso restrito a perfil master',
      content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
    },
  },
});
