/**
 * Registro OpenAPI do módulo Nota.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../registry';
import { createNotaSchema, updateNotaSchema, NOTE_STATUSES } from '@modules/nota/nota.dto';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Schemas registrados
// ---------------------------------------------------------------------------

const ChecklistItemSchema = registry.register(
  'ChecklistItem',
  z.object({
    id: z.string().uuid(),
    texto: z.string(),
    feito: z.boolean(),
    ordem: z.number().int(),
  }).openapi('ChecklistItem'),
);

const NotaSchema = registry.register(
  'Nota',
  z.object({
    id: z.string().uuid(),
    usuarioEmail: z.string().email(),
    titulo: z.string(),
    conteudo: z.string(),
    status: z.enum(NOTE_STATUSES),
    tags: z.array(z.string()),
    cor: z.string().nullable(),
    ordem: z.number().int(),
    items: z.array(ChecklistItemSchema),
    criadoEm: z.string().datetime(),
    atualizadoEm: z.string().datetime(),
  }).openapi('Nota'),
);

const CreateNotaRegistered = registry.register(
  'CreateNotaInput',
  createNotaSchema.openapi('CreateNotaInput'),
);

const UpdateNotaRegistered = registry.register(
  'UpdateNotaInput',
  updateNotaSchema.openapi('UpdateNotaInput'),
);

// ---------------------------------------------------------------------------
// Respostas comuns
// ---------------------------------------------------------------------------

const error401 = {
  description: 'Não autenticado',
  content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
};
const error404 = {
  description: 'Nota não encontrada',
  content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
};
const error422 = {
  description: 'Dados inválidos',
  content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string(), detalhes: z.array(z.object({ campo: z.string(), mensagem: z.string() })).optional() }) } },
};

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/notas',
  tags: ['nota'],
  summary: 'Lista notas do usuário logado',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Notas do usuário',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: z.array(NotaSchema) }) } },
    },
    401: error401,
  },
});

registry.registerPath({
  method: 'get',
  path: '/notas/{id}',
  tags: ['nota'],
  summary: 'Detalhe de uma nota',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Nota encontrada',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: NotaSchema }) } },
    },
    401: error401,
    404: error404,
  },
});

registry.registerPath({
  method: 'post',
  path: '/notas',
  tags: ['nota'],
  summary: 'Cria uma nota',
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: { 'application/json': { schema: CreateNotaRegistered } } },
  },
  responses: {
    201: {
      description: 'Nota criada',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: NotaSchema }) } },
    },
    401: error401,
    422: error422,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/notas/{id}',
  tags: ['nota'],
  summary: 'Atualiza uma nota',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { required: true, content: { 'application/json': { schema: UpdateNotaRegistered } } },
  },
  responses: {
    200: {
      description: 'Nota atualizada',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: NotaSchema }) } },
    },
    401: error401,
    404: error404,
    422: error422,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/notas/{id}',
  tags: ['nota'],
  summary: 'Remove uma nota',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Nota removida',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: z.object({ mensagem: z.string() }) }) } },
    },
    401: error401,
    404: error404,
  },
});
