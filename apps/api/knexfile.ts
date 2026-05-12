import 'dotenv/config';
import type { Knex } from 'knex';

const defaultDb = process.env.DATABASE_URL ||
  'postgresql://flowdesk:flowdesk@localhost:5432/flowdesk';

const base: Knex.Config = {
  client: 'pg',
  connection: defaultDb,
  pool: {
    min: Number(process.env.DATABASE_POOL_MIN || 2),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts',
  },
};

const config: Record<string, Knex.Config> = {
  development: base,
  test: { ...base, connection: process.env.DATABASE_URL_TEST || defaultDb },
  production: base,
};

export default config;
