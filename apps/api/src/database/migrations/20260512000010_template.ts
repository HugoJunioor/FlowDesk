/**
 * tb_template — placeholder pro módulo _template usado como exemplo
 * funcional do padrão modular. Pode ser removida em produção (drop) sem
 * afetar features.
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_template', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.text('nome').notNullable();
    t.text('descricao');
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('excluido_em', { useTz: true });
  });

  await knex.raw('CREATE INDEX idx_tb_template_excluido_em ON tb_template (excluido_em) WHERE excluido_em IS NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_template');
}
