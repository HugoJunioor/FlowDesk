/**
 * tb_auditoria — log append-only de operações relevantes pra LGPD/compliance.
 *
 * Registra: quem fez, em qual recurso, qual ação, payload antes/depois,
 * IP, User-Agent. Nunca atualiza nem deleta (append-only).
 *
 * Particionamento por mês pode ser adicionado quando volume justificar
 * (>1M rows). Por enquanto tabela única + retention via cron.
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_auditoria', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.specificType('usuario_email', 'CITEXT'); // nullable: ação pode vir do sistema
    t.string('recurso', 50).notNullable(); // demanda, usuario, grupo, nota, etc
    t.uuid('recurso_id');
    t.string('acao', 30).notNullable(); // create | update | delete | login | logout | acesso
    t.jsonb('payload_antes');
    t.jsonb('payload_depois');
    t.string('ip', 45);
    t.text('user_agent');
    t.string('request_id', 64);
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_tb_auditoria_recurso ON tb_auditoria (recurso, recurso_id)');
  await knex.raw('CREATE INDEX idx_tb_auditoria_user ON tb_auditoria (usuario_email, criado_em DESC)');
  await knex.raw('CREATE INDEX idx_tb_auditoria_criado_em ON tb_auditoria (criado_em DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_auditoria');
}
