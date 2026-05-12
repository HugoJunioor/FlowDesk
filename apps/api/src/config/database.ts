/**
 * Connection pool global do Postgres (pg).
 *
 * Convenção do padrão Just: Knex SÓ pra migrations/seeds. Em runtime
 * usamos pg puro com queries parametrizadas (mais performático e
 * sem ORM lock-in).
 */
import { Pool } from 'pg';
import { env } from './env';
import { logger } from '@shared/logging/logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX,
  // Em prod com TLS, configure ssl aqui
});

pool.on('error', (err) => {
  logger.error({ err }, 'Erro inesperado no pool do Postgres');
});

export async function closePool(): Promise<void> {
  await pool.end();
}
