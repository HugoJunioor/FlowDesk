/**
 * Gera o documento OpenAPI 3.1 completo.
 *
 * Importar este módulo garante que todos os sub-módulos de registro
 * sejam executados (efeito colateral de import).
 */
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';

// Importa registros de cada módulo — ordem não importa, apenas que rodem.
import './modules/auth.openapi';
import './modules/demanda.openapi';
import './modules/nota.openapi';
import './modules/health.openapi';
import './modules/notificacao.openapi';
import './modules/auditoria.openapi';
import './modules/usuarios.openapi';

import { registry } from './registry';

let cached: OpenAPIObject | null = null;

export function generateOpenApiDocument(): OpenAPIObject {
  if (cached) return cached;

  const generator = new OpenApiGeneratorV31(registry.definitions);

  cached = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Just Flow API',
      version: '1.0.0',
      description:
        'API REST do Just Flow — gestão de demandas internas e Slack da equipe Just.\n\n' +
        '**Auth:** Bearer JWT em todos os endpoints marcados com o cadeado. ' +
        'Obtenha o token via `POST /api/v1/auth/login`.',
      contact: {
        name: 'Equipe Just',
        email: 'suporte@wearejust.it',
      },
    },
    servers: [
      { url: '/api/v1', description: 'Versão atual (v1)' },
    ],
    tags: [
      { name: 'auth', description: 'Autenticação e gerenciamento de sessão' },
      { name: 'demanda', description: 'Gestão de demandas (Slack + Infra)' },
      { name: 'nota', description: 'Bloco de notas pessoal por usuário' },
      { name: 'health', description: 'Health checks da API' },
      { name: 'notificacao', description: 'Notificações de usuário' },
      { name: 'auditoria', description: 'Log de auditoria de mutações' },
      { name: 'usuarios', description: 'Gestão de usuários' },
    ],
  }) as OpenAPIObject;

  return cached;
}
