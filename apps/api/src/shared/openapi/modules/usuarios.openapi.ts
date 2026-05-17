/**
 * Registro OpenAPI do módulo Usuarios.
 *
 * Schemas registrados. Rotas com TODO para expansão futura.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../registry';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Schemas registrados
// ---------------------------------------------------------------------------

// Registra schema do Usuário (usado por outros módulos via $ref)
registry.register(
  'Usuario',
  z.object({
    id: z.string().uuid(),
    login: z.string(),
    email: z.string().email(),
    nome: z.string(),
    perfil: z.enum(['master', 'user']),
    status: z.enum(['active', 'blocked']),
    primeiroAcesso: z.boolean(),
    criadoEm: z.string().datetime(),
    atualizadoEm: z.string().datetime(),
  }).openapi('Usuario'),
);

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'delete',
  path: '/usuarios/{id}/lgpd',
  tags: ['usuarios'],
  summary: 'Anonimiza dados pessoais do usuário (LGPD) — apenas master',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Dados anonimizados com sucesso',
      content: {
        'application/json': {
          schema: z.object({ sucesso: z.literal(true), dados: z.object({ mensagem: z.string() }) }),
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
    404: {
      description: 'Usuário não encontrado',
      content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
    },
  },
});

// TODO: documentar rotas adicionais quando implementadas
// GET  /usuarios
// GET  /usuarios/:id
// POST /usuarios
// PATCH /usuarios/:id
// DELETE /usuarios/:id
