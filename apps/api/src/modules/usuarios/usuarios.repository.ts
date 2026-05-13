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

export const usuariosRepository = {
  async findById(id: string): Promise<UsuarioRow | null> {
    const res = await pool.query<UsuarioRow>(
      `SELECT * FROM tb_usuario WHERE id = $1 LIMIT 1`,
      [id],
    );
    return res.rows[0] ?? null;
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
