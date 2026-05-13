/**
 * Setup global pra testes Jest.
 *
 * Define env vars fake antes da validação Zod do config/env.ts.
 * Sem isso, qualquer import que toca @config/* crasha por env ausente.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test';
process.env.LOG_LEVEL = 'error';
