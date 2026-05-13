/**
 * Seed: grupos padrão com permissões sugeridas.
 *
 * Replica DEFAULT_GROUP_PERMISSIONS de src/types/permissions.ts
 * (apps/web).
 */
import type { Knex } from 'knex';

interface GrupoDefault {
  nome: string;
  descricao: string;
  permissoes: Array<{ modulo: string; acao: string }>;
}

const GRUPOS: GrupoDefault[] = [
  {
    nome: 'Suporte',
    descricao: 'Equipe de atendimento ao cliente',
    permissoes: [
      { modulo: 'dashboard', acao: 'view' },
      { modulo: 'demandas', acao: 'view' },
      { modulo: 'demandas', acao: 'edit' },
      { modulo: 'demandas_sql', acao: 'view' },
      { modulo: 'configuracoes', acao: 'view' },
    ],
  },
  {
    nome: 'Desenvolvimento',
    descricao: 'Time de desenvolvimento/TI',
    permissoes: [
      { modulo: 'dashboard', acao: 'view' },
      { modulo: 'demandas', acao: 'view' },
      { modulo: 'demandas', acao: 'edit' },
      { modulo: 'demandas_sql', acao: 'view' },
      { modulo: 'demandas_sql', acao: 'edit' },
      { modulo: 'sync', acao: 'view' },
      { modulo: 'configuracoes', acao: 'view' },
    ],
  },
  {
    nome: 'Gestão',
    descricao: 'Gerência e coordenação',
    permissoes: [
      { modulo: 'dashboard', acao: 'view' },
      { modulo: 'demandas', acao: 'view' },
      { modulo: 'demandas', acao: 'edit' },
      { modulo: 'demandas', acao: 'create' },
      { modulo: 'demandas', acao: 'export' },
      { modulo: 'demandas_sql', acao: 'view' },
      { modulo: 'demandas_sql', acao: 'export' },
      { modulo: 'relatorios', acao: 'view' },
      { modulo: 'relatorios', acao: 'export' },
      { modulo: 'usuarios', acao: 'view' },
      { modulo: 'configuracoes', acao: 'view' },
    ],
  },
  {
    nome: 'Comercial',
    descricao: 'Time comercial',
    permissoes: [
      { modulo: 'dashboard', acao: 'view' },
      { modulo: 'demandas', acao: 'view' },
      { modulo: 'relatorios', acao: 'view' },
    ],
  },
];

export async function seed(knex: Knex): Promise<void> {
  // Idempotente: só insere o que não existe
  for (const g of GRUPOS) {
    const existing = await knex('tb_grupo').where({ nome: g.nome }).first();
    let grupoId: string;
    if (existing) {
      grupoId = existing.id as string;
      // eslint-disable-next-line no-console
      console.log(`  - grupo "${g.nome}" já existe (id=${grupoId})`);
    } else {
      const [row] = await knex('tb_grupo')
        .insert({ nome: g.nome, descricao: g.descricao })
        .returning('id');
      grupoId = (row as { id: string }).id;
      // eslint-disable-next-line no-console
      console.log(`  + grupo "${g.nome}" criado (id=${grupoId})`);
    }

    for (const p of g.permissoes) {
      await knex('tb_grupo_permissao')
        .insert({ grupo_id: grupoId, modulo: p.modulo, acao: p.acao })
        .onConflict(['grupo_id', 'modulo', 'acao'])
        .ignore();
    }
  }
}
