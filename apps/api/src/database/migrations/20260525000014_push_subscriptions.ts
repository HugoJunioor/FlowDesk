import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS tb_push_subscription (
      id BIGSERIAL PRIMARY KEY,
      usuario_email VARCHAR(320) NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (endpoint)
    )
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_tb_push_subscription_email
    ON tb_push_subscription (usuario_email)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_tb_push_subscription_email`);
  await knex.raw(`DROP TABLE IF EXISTS tb_push_subscription`);
}
