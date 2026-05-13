/**
 * Tabelas relacionadas a demandas:
 *
 * tb_thread_reply: respostas na thread Slack (ou histórico de respostas internas)
 * tb_demanda_anexo: anexos da demanda (base64 inline, igual ao formato atual)
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tb_thread_reply', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('demanda_id').notNullable()
      .references('id').inTable('tb_demanda').onDelete('CASCADE');
    t.string('autor', 200).notNullable();
    t.text('texto').notNullable();
    t.timestamp('timestamp_msg', { useTz: true }).notNullable();
    t.boolean('eh_membro_equipe').notNullable().defaultTo(false);
    t.boolean('tem_check_reaction').notNullable().defaultTo(false);
    t.boolean('tem_loading_reaction').notNullable().defaultTo(false);
    t.jsonb('arquivos'); // array de SlackFile
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_tb_thread_reply_demanda ON tb_thread_reply (demanda_id, timestamp_msg DESC)');
  await knex.raw('CREATE INDEX idx_tb_thread_reply_equipe ON tb_thread_reply (demanda_id, eh_membro_equipe, timestamp_msg DESC)');

  await knex.schema.createTable('tb_demanda_anexo', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('demanda_id').notNullable()
      .references('id').inTable('tb_demanda').onDelete('CASCADE');
    t.text('nome').notNullable();
    t.string('mime_type', 100);
    t.bigInteger('tamanho_bytes');
    // Em prod com volume alto, considerar mover blobs pra object storage
    // (S3, MinIO) e guardar só URL. Pro caso atual (anexos pequenos,
    // baixa quantidade) base64 inline em texto resolve sem operação extra.
    t.text('data_url');
    t.text('url'); // alternativa: URL externa
    t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_tb_demanda_anexo_demanda ON tb_demanda_anexo (demanda_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tb_demanda_anexo');
  await knex.schema.dropTableIfExists('tb_thread_reply');
}
