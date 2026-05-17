/**
 * Registro OpenAPI do módulo Auth.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../registry';
import { loginSchema, changePasswordSchema } from '@modules/auth/auth.dto';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Schemas de resposta (inline — sem DTO próprio pra estes)
// ---------------------------------------------------------------------------

const AuthenticatedUserSchema = registry.register(
  'AuthenticatedUser',
  z.object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    login: z.string().openapi({ example: 'hugo.cordeiro' }),
    email: z.string().email().openapi({ example: 'hugo@wearejust.it' }),
    nome: z.string().openapi({ example: 'Hugo Cordeiro' }),
    perfil: z.enum(['master', 'user']),
    status: z.enum(['active', 'blocked']),
    primeiroAcesso: z.boolean(),
    grupos: z.array(z.string()),
    permissoes: z.array(
      z.object({ modulo: z.string(), acao: z.string() }),
    ),
  }).openapi('AuthenticatedUser'),
);

const AuthResponseSchema = registry.register(
  'AuthResponse',
  z.object({
    sucesso: z.literal(true),
    dados: z.object({
      accessToken: z.string().openapi({ example: 'eyJhbGc...' }),
      expiresIn: z.number().openapi({ example: 900, description: 'Segundos até expirar' }),
      usuario: AuthenticatedUserSchema,
    }),
  }).openapi('AuthResponse'),
);

const LoginBodySchema = registry.register(
  'LoginInput',
  loginSchema.openapi('LoginInput'),
);

const ChangePasswordBodySchema = registry.register(
  'ChangePasswordInput',
  changePasswordSchema.openapi('ChangePasswordInput'),
);

// ---------------------------------------------------------------------------
// Respostas reutilizáveis
// ---------------------------------------------------------------------------

const errorResponse401 = {
  description: 'Não autenticado',
  content: {
    'application/json': {
      schema: z.object({
        erro: z.literal(true),
        mensagem: z.string(),
        codigo: z.string(),
      }),
    },
  },
};

const errorResponse403 = {
  description: 'Sem permissão',
  content: {
    'application/json': {
      schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }),
    },
  },
};

const errorResponse422 = {
  description: 'Dados de entrada inválidos',
  content: {
    'application/json': {
      schema: z.object({
        erro: z.literal(true),
        mensagem: z.string(),
        codigo: z.string(),
        detalhes: z.array(z.object({ campo: z.string(), mensagem: z.string() })).optional(),
      }),
    },
  },
};

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['auth'],
  summary: 'Login com login + senha',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: LoginBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Login realizado com sucesso',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    401: { description: 'Credenciais inválidas', content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } } },
    422: errorResponse422,
    429: { description: 'Rate limit atingido', content: { 'application/json': { schema: z.object({ erro: z.literal(true), mensagem: z.string(), codigo: z.string() }) } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['auth'],
  summary: 'Renova access token via refresh token (cookie HttpOnly)',
  responses: {
    200: {
      description: 'Token renovado',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    401: errorResponse401,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['auth'],
  summary: 'Invalida sessão e limpa cookie de refresh',
  responses: {
    200: {
      description: 'Logout realizado',
      content: {
        'application/json': {
          schema: z.object({ sucesso: z.literal(true), dados: z.object({ mensagem: z.string() }) }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['auth'],
  summary: 'Retorna dados do usuário autenticado',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Dados do usuário logado',
      content: {
        'application/json': {
          schema: z.object({ sucesso: z.literal(true), dados: AuthenticatedUserSchema }),
        },
      },
    },
    401: errorResponse401,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/change-password',
  tags: ['auth'],
  summary: 'Altera senha do usuário autenticado',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: ChangePasswordBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Senha alterada com sucesso',
      content: {
        'application/json': {
          schema: z.object({ sucesso: z.literal(true), dados: z.object({ mensagem: z.string() }) }),
        },
      },
    },
    401: errorResponse401,
    403: errorResponse403,
    422: errorResponse422,
  },
});
