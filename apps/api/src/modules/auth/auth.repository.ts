/**
 * Repositório do módulo Auth.
 *
 * Acesso a tb_usuario, tb_usuario_grupo, tb_grupo_permissao e
 * tb_refresh_token. Queries parametrizadas, sem ORM.
 */
import { pool } from '@config/database';

export interface UsuarioRow {
  id: string;
  login: string;
  email: string;
  nome: string;
  perfil: 'master' | 'user';
  status: 'active' | 'blocked';
  senha_hash: string;
  primeiro_acesso: boolean;
  reset_senha_solicitado: boolean;
  avatar_url: string | null;
  criado_em: Date;
  atualizado_em: Date;
  excluido_em: Date | null;
}

export interface RefreshTokenRow {
  id: string;
  usuario_id: string;
  token_hash: string;
  expira_em: Date;
  revogado_em: Date | null;
  motivo_revogacao: string | null;
  user_agent_resumo: string | null;
  ip: string | null;
  criado_em: Date;
  ultimo_uso_em: Date | null;
}

export const authRepository = {
  async findUserByLogin(login: string): Promise<UsuarioRow | null> {
    const res = await pool.query<UsuarioRow>(
      `SELECT * FROM tb_usuario
       WHERE login = $1 AND excluido_em IS NULL
       LIMIT 1`,
      [login],
    );
    return res.rows[0] ?? null;
  },

  async findUserById(id: string): Promise<UsuarioRow | null> {
    const res = await pool.query<UsuarioRow>(
      `SELECT * FROM tb_usuario
       WHERE id = $1 AND excluido_em IS NULL
       LIMIT 1`,
      [id],
    );
    return res.rows[0] ?? null;
  },

  async listUserGroups(usuarioId: string): Promise<string[]> {
    const res = await pool.query<{ nome: string }>(
      `SELECT g.nome FROM tb_grupo g
       INNER JOIN tb_usuario_grupo ug ON ug.grupo_id = g.id
       WHERE ug.usuario_id = $1
       ORDER BY g.nome`,
      [usuarioId],
    );
    return res.rows.map((r) => r.nome);
  },

  async listUserPermissions(
    usuarioId: string,
  ): Promise<Array<{ modulo: string; acao: string }>> {
    const res = await pool.query<{ modulo: string; acao: string }>(
      `SELECT DISTINCT p.modulo, p.acao
       FROM tb_grupo_permissao p
       INNER JOIN tb_usuario_grupo ug ON ug.grupo_id = p.grupo_id
       WHERE ug.usuario_id = $1
       ORDER BY p.modulo, p.acao`,
      [usuarioId],
    );
    return res.rows;
  },

  async updatePassword(usuarioId: string, novaHash: string): Promise<void> {
    await pool.query(
      `UPDATE tb_usuario
       SET senha_hash = $1,
           primeiro_acesso = false,
           reset_senha_solicitado = false,
           atualizado_em = NOW()
       WHERE id = $2`,
      [novaHash, usuarioId],
    );
  },

  // ===== Refresh tokens =====

  async createRefreshToken(args: {
    usuarioId: string;
    tokenHash: string;
    expiraEm: Date;
    userAgentResumo?: string;
    ip?: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO tb_refresh_token
         (usuario_id, token_hash, expira_em, user_agent_resumo, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        args.usuarioId,
        args.tokenHash,
        args.expiraEm,
        args.userAgentResumo ?? null,
        args.ip ?? null,
      ],
    );
  },

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const res = await pool.query<RefreshTokenRow>(
      `SELECT * FROM tb_refresh_token
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    return res.rows[0] ?? null;
  },

  async revokeRefreshToken(tokenHash: string, motivo: string): Promise<void> {
    await pool.query(
      `UPDATE tb_refresh_token
       SET revogado_em = NOW(), motivo_revogacao = $1
       WHERE token_hash = $2 AND revogado_em IS NULL`,
      [motivo, tokenHash],
    );
  },

  async revokeAllUserRefreshTokens(usuarioId: string, motivo: string): Promise<void> {
    await pool.query(
      `UPDATE tb_refresh_token
       SET revogado_em = NOW(), motivo_revogacao = $1
       WHERE usuario_id = $2 AND revogado_em IS NULL`,
      [motivo, usuarioId],
    );
  },

  async markRefreshTokenUsed(tokenHash: string): Promise<void> {
    await pool.query(
      `UPDATE tb_refresh_token
       SET ultimo_uso_em = NOW()
       WHERE token_hash = $1`,
      [tokenHash],
    );
  },
};
