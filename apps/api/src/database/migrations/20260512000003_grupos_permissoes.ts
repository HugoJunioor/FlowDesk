/**
 * Tabelas de grupos e permissões.
 *
 * tb_grupo: agrupamento de usuários (Suporte, Desenvolvimento, etc)
 * tb_usuario_grupo: junction many-to-many usuário <-> grupo
 * tb_grupo_permissao: permissões granulares por grupo (modulo + ação)
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_grupo', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('nome', 100).notNullable().unique();
    t.text('descricao');
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tb_usuario_grupo', (t) => {
    t.uuid('usuario_id').notNullable()
      .references('id').inTable('tb_usuario').onDelete('CASCADE');
    t.uuid('grupo_id').notNullable()
      .references('id').inTable('tb_grupo').onDelete('CASCADE');
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.primary(['usuario_id', 'grupo_id']);
  });

  await knex.schema.createTable('tb_grupo_permissao', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('grupo_id').notNullable()
      .references('id').inTable('tb_grupo').onDelete('CASCADE');
    t.string('modulo', 50).notNullable();
    t.string('acao', 20).notNullable();
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.unique(['grupo_id', 'modulo', 'acao'], { indexName: 'uq_tb_grupo_permissao' });
    t.check(
      "modulo IN ('dashboard','demandas','demandas_sql','infra','usuarios','grupos','configuracoes','relatorios','sync','notas')",
      [],
      'tb_grupo_permissao_modulo_check',
    );
    t.check(
      "acao IN ('view','create','edit','delete','export')",
      [],
      'tb_grupo_permissao_acao_check',
    );
  });

  await knex.raw('CREATE INDEX idx_tb_grupo_permissao_grupo ON tb_grupo_permissao (grupo_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_grupo_permissao');
  await knex.schema.dropTableIfExists('tb_usuario_grupo');
  await knex.schema.dropTableIfExists('tb_grupo');
}
