/**
 * Repositório do módulo Usuarios.
 *
 * Operações de escrita sobre tb_usuario.
 * Leitura de dados básicos (find by id) reaproveitada do auth.repository.
 */
import { pool } from '@config/database';
import type { UsuarioRow } from '@modules/auth/auth.repository';

export interface AnonimizacaoResult {
  id: string;
  anonimizadoEm: Date;
}

export interface UsuarioPublico {
  id: string;
  login: string;
  email: string;
  nome: string;
  perfil: 'master' | 'user';
  status: 'active' | 'blocked';
  primeiroAcesso: boolean;
  resetSenhaSolicitado: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CreateUsuarioData {
  login: string;
  email: string;
  nome: string;
  perfil: 'master' | 'user';
  senhaHash: string;
}

export interface UpdateUsuarioData {
  nome?: string;
  perfil?: 'master' | 'user';
  status?: 'active' | 'blocked';
}

function toPublico(row: UsuarioRow): UsuarioPublico {
  return {
    id: row.id,
    login: row.login,
    email: row.email,
    nome: row.nome,
    perfil: row.perfil,
    status: row.status,
    primeiroAcesso: row.primeiro_acesso,
    resetSenhaSolicitado: row.reset_senha_solicitado,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export const usuariosRepository = {
  async findById(id: string): Promise<UsuarioRow | null> {
    const res = await pool.query<UsuarioRow>(
      `SELECT * FROM tb_usuario WHERE id = $1 LIMIT 1`,
      [id],
    );
    return res.rows[0] ?? null;
  },

  async list(): Promise<UsuarioPublico[]> {
    const res = await pool.query<UsuarioRow>(
      `SELECT * FROM tb_usuario
       WHERE excluido_em IS NULL
       ORDER BY nome`,
    );
    return res.rows.map(toPublico);
  },

  async create(data: CreateUsuarioData): Promise<UsuarioPublico> {
    const res = await pool.query<UsuarioRow>(
      `INSERT INTO tb_usuario (login, email, nome, perfil, senha_hash, status, primeiro_acesso, reset_senha_solicitado)
       VALUES ($1, $2, $3, $4, $5, 'active', true, false)
       RETURNING *`,
      [data.login, data.email, data.nome, data.perfil, data.senhaHash],
    );
    if (!res.rows[0]) throw new Error('Failed to insert usuario');
    return toPublico(res.rows[0]);
  },

  async update(id: string, data: UpdateUsuarioData): Promise<UsuarioPublico | null> {
    const setClauses: string[] = ['atualizado_em = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (data.nome !== undefined) {
      setClauses.push(`nome = $${idx++}`);
      values.push(data.nome);
    }
    if (data.perfil !== undefined) {
      setClauses.push(`perfil = $${idx++}`);
      values.push(data.perfil);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(data.status);
    }

    values.push(id);
    const res = await pool.query<UsuarioRow>(
      `UPDATE tb_usuario SET ${setClauses.join(', ')}
       WHERE id = $${idx} AND excluido_em IS NULL
       RETURNING *`,
      values,
    );
    return res.rows[0] ? toPublico(res.rows[0]) : null;
  },

  async softDelete(id: string): Promise<boolean> {
    const res = await pool.query(
      `UPDATE tb_usuario SET excluido_em = NOW(), atualizado_em = NOW(), status = 'blocked'
       WHERE id = $1 AND excluido_em IS NULL AND perfil != 'master'`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  },

  async resetPassword(id: string, senhaHash: string): Promise<boolean> {
    const res = await pool.query(
      `UPDATE tb_usuario
       SET senha_hash = $1,
           primeiro_acesso = true,
           reset_senha_solicitado = false,
           atualizado_em = NOW()
       WHERE id = $2 AND excluido_em IS NULL`,
      [senhaHash, id],
    );
    return (res.rowCount ?? 0) > 0;
  },

  async loginExists(login: string, excludeId?: string): Promise<boolean> {
    const res = excludeId
      ? await pool.query(
          `SELECT 1 FROM tb_usuario WHERE login = $1 AND id != $2 AND excluido_em IS NULL LIMIT 1`,
          [login, excludeId],
        )
      : await pool.query(
          `SELECT 1 FROM tb_usuario WHERE login = $1 AND excluido_em IS NULL LIMIT 1`,
          [login],
        );
    return (res.rowCount ?? 0) > 0;
  },

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const res = excludeId
      ? await pool.query(
          `SELECT 1 FROM tb_usuario WHERE email = $1 AND id != $2 AND excluido_em IS NULL LIMIT 1`,
          [email, excludeId],
        )
      : await pool.query(
          `SELECT 1 FROM tb_usuario WHERE email = $1 AND excluido_em IS NULL LIMIT 1`,
          [email],
        );
    return (res.rowCount ?? 0) > 0;
  },

  async anonimizar(id: string, campos: {
    email: string;
    nome: string;
    login: string;
    senhaHash: string;
  }): Promise<AnonimizacaoResult> {
    const res = await pool.query<{ id: string; excluido_em: Date }>(
      `UPDATE tb_usuario
       SET
         email         = $1,
         nome          = $2,
         login         = $3,
         senha_hash    = $4,
         status        = 'blocked',
         excluido_em   = NOW(),
         atualizado_em = NOW()
       WHERE id = $5
       RETURNING id, excluido_em`,
      [campos.email, campos.nome, campos.login, campos.senhaHash, id],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error(`Usuário ${id} não encontrado ao anonimizar`);
    }

    return { id: row.id, anonimizadoEm: row.excluido_em };
  },
};
