/**
 * Tabela tb_usuario — usuários internos do FlowDesk.
 *
 * Mapeia FlowDeskUser (src/types/auth.ts). Login e email são unique
 * case-insensitive (CITEXT).
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_usuario', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.specificType('login', 'CITEXT').notNullable().unique();
    t.specificType('email', 'CITEXT').notNullable().unique();
    t.text('nome').notNullable();
    t.string('perfil', 20).notNullable().defaultTo('user'); // master | user
    t.string('status', 20).notNullable().defaultTo('active'); // active | blocked
    t.text('senha_hash').notNullable();
    t.boolean('primeiro_acesso').notNullable().defaultTo(true);
    t.boolean('reset_senha_solicitado').notNullable().defaultTo(false);
    t.text('avatar_url');
    t.string('criado_por', 100);
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('excluido_em', { useTz: true }); // soft delete

    // Constraint de valores válidos
    t.check("perfil IN ('master','user')", [], 'tb_usuario_perfil_check');
    t.check("status IN ('active','blocked')", [], 'tb_usuario_status_check');
  });

  await knex.raw('CREATE INDEX idx_tb_usuario_excluido_em ON tb_usuario (excluido_em) WHERE excluido_em IS NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_usuario');
}
