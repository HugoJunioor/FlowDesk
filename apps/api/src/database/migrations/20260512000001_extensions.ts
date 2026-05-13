/**
 * Extensões base do Postgres usadas pelo schema:
 * - uuid-ossp: geração de UUIDs (uuid_generate_v4)
 * - citext: case-insensitive text (usado em emails, logins)
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "citext"');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP EXTENSION IF EXISTS "citext"');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}
