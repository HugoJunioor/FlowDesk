/**
 * tb_refresh_token — usado pela Fase 3 (JWT auth).
 *
 * Cada login gera um refresh token de longa duração (7d). O acesso token
 * (curto, 15min) é regenerado via /auth/refresh enquanto este aqui ainda
 * for válido. Permite revogar sessão server-side (logout em outros devices).
 *
 * Indexado por hash do token (não armazenamos o token plano — só o
 * SHA-256 dele pra verificação).
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_refresh_token', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('usuario_id').notNullable()
      .references('id').inTable('tb_usuario').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().unique(); // SHA-256 hex (64 chars)
    t.timestamp('expira_em', { useTz: true }).notNullable();
    t.timestamp('revogado_em', { useTz: true });
    t.string('motivo_revogacao', 100);
    t.string('user_agent_resumo', 200);
    t.string('ip', 45);
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('ultimo_uso_em', { useTz: true });
  });

  await knex.raw('CREATE INDEX idx_tb_refresh_token_user ON tb_refresh_token (usuario_id) WHERE revogado_em IS NULL');
  await knex.raw('CREATE INDEX idx_tb_refresh_token_expira ON tb_refresh_token (expira_em) WHERE revogado_em IS NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_refresh_token');
}
