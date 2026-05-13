/**
 * Tabela tb_demanda — consolida demandas Slack + demandas internas (Infra).
 *
 * Origem (slack | internal) diferencia. Campos infra_* só preenchidos
 * quando origem='internal'. Campos slack_* só quando origem='slack'.
 *
 * Decisão: tabela única em vez de duas — overhead operacional menor,
 * queries de "todas as demandas do user" mais simples, e a maioria dos
 * campos é compartilhada.
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_demanda', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.text('titulo').notNullable();
    t.text('descricao');

    t.string('prioridade', 30).notNullable().defaultTo('sem_classificacao');
    t.string('status', 30).notNullable().defaultTo('aberta');
    t.string('tipo_demanda', 100);
    t.string('workflow', 200);
    t.string('produto', 100);
    t.string('origem', 20).notNullable(); // slack | internal

    // Solicitante (cliente externo ou interno)
    t.string('solicitante_nome', 200);
    t.text('solicitante_avatar');

    // Responsável (membro da equipe)
    t.string('responsavel_nome', 200);
    t.text('responsavel_avatar');

    // Infra (origem=internal)
    t.string('infra_kind', 20); // sql | deploy
    t.text('infra_query');
    t.string('infra_database', 100);
    t.text('infra_external_link');

    // Slack (origem=slack)
    t.string('canal_slack', 100);
    t.text('permalink_slack');
    t.integer('replies').notNullable().defaultTo(0);

    // SLA
    t.timestamp('due_date', { useTz: true });
    t.timestamp('concluida_em', { useTz: true });
    t.timestamp('service_started_at', { useTz: true });
    t.integer('sla_first_response');
    t.string('sla_status', 50);
    t.string('sla_resolution_status', 50);
    t.integer('resolution_hours');
    t.text('expiration_reason');

    // Tarefa externa
    t.boolean('has_task').notNullable().defaultTo(false);
    t.text('task_link');

    // Tags
    t.specificType('tags', 'TEXT[]').defaultTo('{}');

    // Análise e classificação
    t.jsonb('closure');
    t.jsonb('auto_classification');
    t.jsonb('status_analysis');
    t.boolean('manual_status_override').notNullable().defaultTo(false);
    t.string('closure_source', 50);

    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('excluido_em', { useTz: true }); // soft delete

    t.check("origem IN ('slack','internal')", [], 'tb_demanda_origem_check');
    t.check(
      "prioridade IN ('p1','p2','p3','sem_classificacao')",
      [],
      'tb_demanda_prioridade_check',
    );
    t.check(
      "status IN ('aberta','em_andamento','concluida','expirada')",
      [],
      'tb_demanda_status_check',
    );
    t.check(
      "infra_kind IS NULL OR infra_kind IN ('sql','deploy')",
      [],
      'tb_demanda_infra_kind_check',
    );
  });

  // Indexes importantes pra queries comuns
  await knex.raw('CREATE INDEX idx_tb_demanda_status ON tb_demanda (status) WHERE excluido_em IS NULL');
  await knex.raw('CREATE INDEX idx_tb_demanda_origem ON tb_demanda (origem) WHERE excluido_em IS NULL');
  await knex.raw('CREATE INDEX idx_tb_demanda_responsavel ON tb_demanda (responsavel_nome) WHERE excluido_em IS NULL');
  await knex.raw('CREATE INDEX idx_tb_demanda_solicitante ON tb_demanda (solicitante_nome) WHERE excluido_em IS NULL');
  await knex.raw('CREATE INDEX idx_tb_demanda_due_date ON tb_demanda (due_date) WHERE excluido_em IS NULL AND status NOT IN (\'concluida\',\'expirada\')');
  await knex.raw('CREATE INDEX idx_tb_demanda_criado_em ON tb_demanda (criado_em DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_demanda');
}
