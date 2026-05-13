/**
 * Sistema de notificações:
 *
 * tb_notificacao: inbox por usuário (substitui notifications.json)
 * tb_preferencia_notificacao: prefs do user (substitui notificationPreferences.json)
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_notificacao', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.specificType('usuario_email', 'CITEXT').notNullable();
    t.string('evento', 50).notNullable();
    t.string('origem', 20).notNullable().defaultTo('slack');
    t.uuid('demanda_id'); // soft FK — demanda pode ter sido apagada
    t.text('titulo').notNullable();
    t.text('mensagem');
    t.string('ator', 200);
    t.boolean('lida').notNullable().defaultTo(false);
    t.timestamp('lida_em', { useTz: true });
    t.specificType('enviada_por', 'TEXT[]'); // canais ['inbox','browser_push','email']
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.check(
      `evento IN (
        'demand_assigned','demand_replied','demand_started','demand_completed',
        'demand_reopened','demand_overdue','demand_due_soon','demand_created'
      )`,
      [],
      'tb_notificacao_evento_check',
    );
    t.check("origem IN ('slack','infra')", [], 'tb_notificacao_origem_check');
  });

  // Index pro fetch da inbox do user (ordenado desc por criado_em)
  await knex.raw('CREATE INDEX idx_tb_notificacao_user ON tb_notificacao (usuario_email, criado_em DESC)');
  await knex.raw('CREATE INDEX idx_tb_notificacao_user_lida ON tb_notificacao (usuario_email, lida) WHERE lida = false');

  await knex.schema.createTable('tb_preferencia_notificacao', (t) => {
    t.specificType('usuario_email', 'CITEXT').primary();
    // jsonb pra flexibilidade: { demand_assigned: true, demand_replied: false, ... }
    t.jsonb('eventos').notNullable().defaultTo('{}');
    // { inbox: true, browserPush: false, email: false }
    t.jsonb('canais').notNullable().defaultTo('{"inbox":true,"browserPush":false,"email":false}');
    // { p1Hours: 1, p2Hours: 2, p3Hours: 4 }
    t.jsonb('sla_reminders').notNullable().defaultTo('{"p1Hours":1,"p2Hours":2,"p3Hours":4}');
    t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_preferencia_notificacao');
  await knex.schema.dropTableIfExists('tb_notificacao');
}
