/**
 * Repositório de demandas — opera em tb_demanda (Slack + Infra).
 */
import { pool } from '@config/database';
import { buildInsert, paginate, sanitizeSearch } from '@shared/database/query-builder';
import type {
  CreateInfraInput,
  Demanda,
  DemandOrigin,
  DemandPriority,
  DemandStatus,
  InfraKind,
  ListDemandaQuery,
  UpdateDemandaInput,
} from './demanda.dto';

interface DemandaRow {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: DemandPriority;
  status: DemandStatus;
  tipo_demanda: string | null;
  workflow: string | null;
  produto: string | null;
  origem: DemandOrigin;
  solicitante_nome: string | null;
  solicitante_avatar: string | null;
  responsavel_nome: string | null;
  responsavel_avatar: string | null;
  infra_kind: InfraKind | null;
  infra_query: string | null;
  infra_database: string | null;
  infra_external_link: string | null;
  canal_slack: string | null;
  permalink_slack: string | null;
  replies: number;
  due_date: Date | null;
  concluida_em: Date | null;
  service_started_at: Date | null;
  has_task: boolean;
  task_link: string | null;
  tags: string[];
  criado_em: Date;
  atualizado_em: Date;
  excluido_em: Date | null;
}

function rowToEntity(r: DemandaRow): Demanda {
  return {
    id: r.id,
    origem: r.origem,
    titulo: r.titulo,
    descricao: r.descricao,
    prioridade: r.prioridade,
    status: r.status,
    tipoDemanda: r.tipo_demanda,
    workflow: r.workflow,
    produto: r.produto,
    solicitanteNome: r.solicitante_nome,
    solicitanteAvatar: r.solicitante_avatar,
    responsavelNome: r.responsavel_nome,
    responsavelAvatar: r.responsavel_avatar,
    infraKind: r.infra_kind,
    infraQuery: r.infra_query,
    infraDatabase: r.infra_database,
    infraExternalLink: r.infra_external_link,
    canalSlack: r.canal_slack,
    permalinkSlack: r.permalink_slack,
    replies: r.replies,
    dueDate: r.due_date,
    concluidaEm: r.concluida_em,
    serviceStartedAt: r.service_started_at,
    hasTask: r.has_task,
    taskLink: r.task_link,
    tags: r.tags ?? [],
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export const demandaRepository = {
  async list(
    query: ListDemandaQuery,
  ): Promise<{ rows: Demanda[]; total: number }> {
    const { limit, offset } = paginate(query.pagina, query.limite);
    const conds: string[] = ['excluido_em IS NULL'];
    const values: unknown[] = [];
    if (query.origem) {
      values.push(query.origem);
      conds.push(`origem = $${values.length}`);
    }
    if (query.status) {
      values.push(query.status);
      conds.push(`status = $${values.length}`);
    }
    if (query.prioridade) {
      values.push(query.prioridade);
      conds.push(`prioridade = $${values.length}`);
    }
    if (query.responsavel) {
      values.push(query.responsavel);
      conds.push(`responsavel_nome = $${values.length}`);
    }
    if (query.busca) {
      values.push(sanitizeSearch(query.busca));
      conds.push(`(titulo ILIKE $${values.length} OR descricao ILIKE $${values.length})`);
    }
    const where = conds.join(' AND ');

    const totalRes = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM tb_demanda WHERE ${where}`,
      values,
    );
    const total = Number(totalRes.rows[0]?.total ?? 0);

    values.push(limit);
    values.push(offset);
    const res = await pool.query<DemandaRow>(
      `SELECT * FROM tb_demanda
       WHERE ${where}
       ORDER BY criado_em DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return { rows: res.rows.map(rowToEntity), total };
  },

  async findById(id: string): Promise<Demanda | null> {
    const res = await pool.query<DemandaRow>(
      `SELECT * FROM tb_demanda
       WHERE id = $1 AND excluido_em IS NULL
       LIMIT 1`,
      [id],
    );
    const row = res.rows[0];
    return row ? rowToEntity(row) : null;
  },

  async createInfra(args: {
    solicitante: { nome: string; avatar: string | null };
    input: CreateInfraInput;
  }): Promise<Demanda> {
    const { sql, values } = buildInsert(
      'tb_demanda',
      {
        titulo: args.input.titulo,
        descricao: args.input.descricao ?? null,
        prioridade: args.input.prioridade,
        status: 'aberta' as DemandStatus,
        origem: 'internal' as DemandOrigin,
        solicitante_nome: args.solicitante.nome,
        solicitante_avatar: args.solicitante.avatar,
        responsavel_nome: args.input.responsavelNome,
        responsavel_avatar: args.input.responsavelAvatar ?? null,
        infra_kind: args.input.infraKind,
        infra_query: args.input.infraQuery ?? null,
        infra_database: args.input.infraDatabase ?? null,
        infra_external_link: args.input.infraExternalLink ?? null,
        due_date: args.input.dueDate ? new Date(args.input.dueDate) : null,
        tags: args.input.tags,
      },
      ['*'],
    );
    const res = await pool.query<DemandaRow>(sql, values);
    const row = res.rows[0];
    if (!row) throw new Error('INSERT em tb_demanda nao retornou linha');
    return rowToEntity(row);
  },

  async update(id: string, input: UpdateDemandaInput): Promise<Demanda | null> {
    const setParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const add = (col: string, val: unknown): void => {
      setParts.push(`${col} = $${idx++}`);
      values.push(val);
    };
    if (input.titulo !== undefined) add('titulo', input.titulo);
    if (input.descricao !== undefined) add('descricao', input.descricao);
    if (input.prioridade !== undefined) add('prioridade', input.prioridade);
    if (input.status !== undefined) {
      add('status', input.status);
      if (input.status === 'concluida') add('concluida_em', new Date());
      if (input.status === 'em_andamento') add('service_started_at', new Date());
    }
    if (input.responsavelNome !== undefined) add('responsavel_nome', input.responsavelNome);
    if (input.responsavelAvatar !== undefined) add('responsavel_avatar', input.responsavelAvatar);
    if (input.dueDate !== undefined) add('due_date', input.dueDate ? new Date(input.dueDate) : null);
    if (input.tags !== undefined) add('tags', input.tags);
    if (input.infraQuery !== undefined) add('infra_query', input.infraQuery);
    if (input.infraDatabase !== undefined) add('infra_database', input.infraDatabase);
    if (input.infraExternalLink !== undefined) add('infra_external_link', input.infraExternalLink);
    if (input.taskLink !== undefined) add('task_link', input.taskLink);
    if (input.hasTask !== undefined) add('has_task', input.hasTask);

    if (setParts.length === 0) {
      return this.findById(id);
    }

    setParts.push(`atualizado_em = NOW()`);
    values.push(id);
    const res = await pool.query<DemandaRow>(
      `UPDATE tb_demanda SET ${setParts.join(', ')}
       WHERE id = $${idx} AND excluido_em IS NULL
       RETURNING *`,
      values,
    );
    const row = res.rows[0];
    return row ? rowToEntity(row) : null;
  },

  async softDelete(id: string): Promise<boolean> {
    const res = await pool.query(
      `UPDATE tb_demanda SET excluido_em = NOW()
       WHERE id = $1 AND excluido_em IS NULL`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  },
};
