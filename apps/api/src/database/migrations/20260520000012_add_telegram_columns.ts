import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE tb_usuario
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
    ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMPTZ
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_tb_usuario_telegram_chat_id
    ON tb_usuario (telegram_chat_id)
    WHERE telegram_chat_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_tb_usuario_telegram_chat_id`);
  await knex.raw(`
    ALTER TABLE tb_usuario
    DROP COLUMN IF EXISTS telegram_connected_at,
    DROP COLUMN IF EXISTS telegram_chat_id
  `);
}
