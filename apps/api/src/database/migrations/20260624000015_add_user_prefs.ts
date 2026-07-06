import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // theme_preferences stores { mode, colorTheme } – nullable so existing rows default to null
  await knex.raw(`
    ALTER TABLE tb_usuario
      ADD COLUMN IF NOT EXISTS theme_preferences JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE tb_usuario
      DROP COLUMN IF EXISTS theme_preferences,
      DROP COLUMN IF EXISTS language
  `);
}
