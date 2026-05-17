/**
 * Registro OpenAPI do módulo Demanda.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../registry';
import {
  listDemandaQuerySchema,
  createInfraSchema,
  updateDemandaSchema,
  DEMAND_PRIORITIES,
  DEMAND_STATUSES,
  DEMAND_ORIGINS,
  INFRA_KINDS,
} from '@modules/demanda/demanda.dto';
import { addReplySchema, updateClosureSchema } from '@modules/demanda/thread.dto';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Schemas registrados
// ---------------------------------------------------------------------------

const DemandaSchema = registry.register(
  'Demanda',
  z.object({
    id: z.string().uuid(),
    origem: z.enum(DEMAND_ORIGINS),
    titulo: z.string(),
    descricao: z.string().nullable(),
    prioridade: z.enum(DEMAND_PRIORITIES),
    status: z.enum(DEMAND_STATUSES),
    tipoDemanda: z.string().nullable(),
    workflow: z.string().nullable(),
    produto: z.string().nullable(),
    solicitanteNome: z.string().nullable(),
    solicitanteAvatar: z.string().nullable(),
    responsavelNome: z.string().nullable(),
    responsavelAvatar: z.string().nullable(),
    infraKind: z.enum(INFRA_KINDS).nullable(),
    infraQuery: z.string().nullable(),
    infraDatabase: z.string().nullable(),
    infraExternalLink: z.string().nullable(),
    canalSlack: z.string().nullable(),
    permalinkSlack: z.string().nullable(),
    replies: z.number().int(),
    dueDate: z.string().datetime().nullable(),
    concluidaEm: z.string().datetime().nullable(),
    serviceStartedAt: z.string().datetime().nullable(),
    hasTask: z.boolean(),
    taskLink: z.string().nullable(),
    tags: z.array(z.string()),
    criadoEm: z.string().datetime(),
    atualizadoEm: z.string().datetime(),
  }).openapi('Demanda'),
);

const ThreadReplySchema = registry.register(
  'ThreadReply',
  z.object({
    id: z.string().uuid(),
    demandaId: z.string().uuid(),
    autor: z.string(),
    texto: z.string(),
    timestampMsg: z.string().datetime(),
    ehMembroEquipe: z.boolean(),
    temCheckReaction: z.boolean(),
    temLoadingReaction: z.boolean(),
    arquivos: z.array(z.unknown()).nullable(),
    criadoEm: z.string().datetime(),
  }).openapi('ThreadReply'),
);

const ListDemandaQueryRegistered = registry.register(
  'ListDemandaQuery',
  listDemandaQuerySchema.openapi('ListDemandaQuery'),
);

const CreateInfraRegistered = registry.register(
  'CreateInfraInput',
  createInfraSchema.openapi('CreateInfraInput'),
);

const UpdateDemandaRegistered = registry.register(
  'UpdateDemandaInput',
  updateDemandaSchema.openapi('UpdateDemandaInput'),
);

const AddReplyRegistered = registry.register(
  'AddReplyInput',
  addReplySchema.openapi('AddReplyInput'),
);

const UpdateClosureRegistered = registry.register(
  'UpdateClosureInput',
  updateClosureSchema.openapi('UpdateClosureInput'),
);

// ---------------------------------------------------------------------------
// Respostas comuns
// ---------------------------------------------------------------------------

const error401 = {
  description: 'Não autenticado',
  content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } },
};
const error404 = {
  description: 'Demanda não encontrada',
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
  path: '/demandas',
  tags: ['demanda'],
  summary: 'Lista demandas paginadas com filtros',
  security: [{ bearerAuth: [] }],
  request: { query: ListDemandaQueryRegistered },
  responses: {
    200: {
      description: 'Lista de demandas',
      content: {
        'application/json': {
          schema: z.object({
            sucesso: z.literal(true),
            dados: z.object({
              items: z.array(DemandaSchema),
              total: z.number().int(),
              pagina: z.number().int(),
              limite: z.number().int(),
              totalPaginas: z.number().int(),
            }),
          }),
        },
      },
    },
    401: error401,
    422: error422,
  },
});

registry.registerPath({
  method: 'get',
  path: '/demandas/{id}',
  tags: ['demanda'],
  summary: 'Detalhe de uma demanda',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Demanda encontrada',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: DemandaSchema }) } },
    },
    401: error401,
    404: error404,
  },
});

registry.registerPath({
  method: 'post',
  path: '/demandas/infra',
  tags: ['demanda'],
  summary: 'Cria demanda interna (Infra)',
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: { 'application/json': { schema: CreateInfraRegistered } } },
  },
  responses: {
    201: {
      description: 'Demanda criada',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: DemandaSchema }) } },
    },
    401: error401,
    422: error422,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/demandas/{id}',
  tags: ['demanda'],
  summary: 'Atualiza campos de uma demanda',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { required: true, content: { 'application/json': { schema: UpdateDemandaRegistered } } },
  },
  responses: {
    200: {
      description: 'Demanda atualizada',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: DemandaSchema }) } },
    },
    401: error401,
    404: error404,
    422: error422,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/demandas/{id}',
  tags: ['demanda'],
  summary: 'Remove uma demanda',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Demanda removida',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: z.object({ mensagem: z.string() }) }) } },
    },
    401: error401,
    404: error404,
  },
});

registry.registerPath({
  method: 'post',
  path: '/demandas/{id}/atender',
  tags: ['demanda'],
  summary: 'Marca demanda como "em_andamento"',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Demanda atualizada para em_andamento',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: DemandaSchema }) } },
    },
    401: error401,
    404: error404,
  },
});

registry.registerPath({
  method: 'post',
  path: '/demandas/{id}/concluir',
  tags: ['demanda'],
  summary: 'Marca demanda como "concluida"',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Demanda concluída',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: DemandaSchema }) } },
    },
    401: error401,
    404: error404,
  },
});

registry.registerPath({
  method: 'get',
  path: '/demandas/{id}/replies',
  tags: ['demanda'],
  summary: 'Lista replies de uma thread Slack',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Replies da thread',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: z.array(ThreadReplySchema) }) } },
    },
    401: error401,
    404: error404,
  },
});

registry.registerPath({
  method: 'post',
  path: '/demandas/{id}/replies',
  tags: ['demanda'],
  summary: 'Adiciona reply numa thread Slack',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { required: true, content: { 'application/json': { schema: AddReplyRegistered } } },
  },
  responses: {
    201: {
      description: 'Reply adicionado',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: ThreadReplySchema }) } },
    },
    401: error401,
    404: error404,
    422: error422,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/demandas/{id}/closure',
  tags: ['demanda'],
  summary: 'Atualiza dados de encerramento da demanda',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { required: true, content: { 'application/json': { schema: UpdateClosureRegistered } } },
  },
  responses: {
    200: {
      description: 'Closure atualizado',
      content: { 'application/json': { schema: z.object({ sucesso: z.literal(true), dados: DemandaSchema }) } },
    },
    401: error401,
    404: error404,
    422: error422,
  },
});
