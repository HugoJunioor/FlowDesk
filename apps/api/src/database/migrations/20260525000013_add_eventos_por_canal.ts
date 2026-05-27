import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE tb_preferencia_notificacao
    ADD COLUMN IF NOT EXISTS eventos_por_canal JSONB
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE tb_preferencia_notificacao
    DROP COLUMN IF EXISTS eventos_por_canal
  `);
}
