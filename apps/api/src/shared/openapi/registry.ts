/**
 * Singleton do OpenAPIRegistry.
 *
 * Todos os módulos importam este registry pra registrar seus schemas e rotas.
 * Um único ponto evita múltiplos registries e duplicidade de componentes.
 */
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

export const registry = new OpenAPIRegistry();

// ---------------------------------------------------------------------------
// Security scheme global: Bearer JWT
// ---------------------------------------------------------------------------
export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Token JWT obtido via POST /api/v1/auth/login',
});
