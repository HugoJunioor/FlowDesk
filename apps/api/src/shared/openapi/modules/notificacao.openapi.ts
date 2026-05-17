/**
 * Registro OpenAPI do módulo Notificacao.
 *
 * Schemas registrados. Rotas com TODO para expansão futura.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../registry';
import {
  createNotificacaoSchema,
  patchNotificacaoSchema,
  preferenciaSchema,
  NOTIFICATION_EVENTS,
} from '@modules/notificacao/notificacao.dto';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Schemas registrados
// ---------------------------------------------------------------------------

const NotificacaoSchema = registry.register(
  'Notificacao',
  z.object({
    id: z.string().uuid(),
    usuarioEmail: z.string().email(),
    evento: z.enum(NOTIFICATION_EVENTS),
    origem: z.enum(['slack', 'infra']),
    demandaId: z.string().uuid().nullable(),
    titulo: z.string(),
    mensagem: z.string().nullable(),
    ator: z.string().nullable(),
    lida: z.boolean(),
    lidaEm: z.string().datetime().nullable(),
    enviadaPor: z.array(z.string()).nullable(),
    criadoEm: z.string().datetime(),
  }).openapi('Notificacao'),
);

registry.register('CreateNotificacaoInput', createNotificacaoSchema.openapi('CreateNotificacaoInput'));
registry.register('PatchNotificacaoInput', patchNotificacaoSchema.openapi('PatchNotificacaoInput'));
registry.register('PreferenciaInput', preferenciaSchema.openapi('PreferenciaInput'));

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
// TODO: documentar rotas completas
// GET  /notificacoes
// POST /notificacoes
// PATCH /notificacoes/:id
// POST /notificacoes/mark-all-read
// GET  /notificacoes/preferences
// PUT  /notificacoes/preferences

registry.registerPath({
  method: 'get',
  path: '/notificacoes',
  tags: ['notificacao'],
  summary: 'Lista notificações do usuário logado',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Notificações do usuário',
      content: {
        'application/json': {
          schema: z.object({ sucesso: z.literal(true), dados: z.array(NotificacaoSchema) }),
        },
      },
    },
    401: {
      description: 'Não autenticado',
      content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
    },
  },
});
