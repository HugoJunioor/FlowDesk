/**
 * Bloco de notas pessoal (substitui data/notes.json).
 *
 * tb_nota: nota com título, conteúdo, status (Kanban), tags, cor
 * tb_item_nota: itens de checklist dentro de uma nota
 *
 * Cada nota pertence a UM usuário (usuario_email). Não há
 * compartilhamento — privacidade por design.
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_nota', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.specificType('usuario_email', 'CITEXT').notNullable();
    t.text('titulo').notNullable();
    t.text('conteudo').notNullable().defaultTo('');
    t.string('status', 20).notNullable().defaultTo('todo'); // todo | doing | done
    t.specificType('tags', 'TEXT[]').notNullable().defaultTo('{}');
    t.string('cor', 50);
    // Ordem dentro da coluna (menor = topo). Default = epoch ms da criação.
    t.bigInteger('ordem').notNullable();
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('excluido_em', { useTz: true });

    t.check("status IN ('todo','doing','done')", [], 'tb_nota_status_check');
  });

  await knex.raw('CREATE INDEX idx_tb_nota_user ON tb_nota (usuario_email, status, ordem) WHERE excluido_em IS NULL');

  await knex.schema.createTable('tb_item_nota', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('nota_id').notNullable()
      .references('id').inTable('tb_nota').onDelete('CASCADE');
    t.text('texto').notNullable();
    t.boolean('feito').notNullable().defaultTo(false);
    t.integer('ordem').notNullable().defaultTo(0);
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_tb_item_nota_nota ON tb_item_nota (nota_id, ordem)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_item_nota');
  await knex.schema.dropTableIfExists('tb_nota');
}
