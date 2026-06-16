/**
 * Service do módulo Usuarios.
 *
 * Responsável por:
 *   - CRUD de usuários (list, create, update, delete, reset password)
 *   - Anonimização LGPD (right-to-be-forgotten): substitui dados PII por
 *     valores anônimos e invalida a conta, preservando o id para FKs.
 *
 * Convenções:
 *   - Senha aleatória bcrypt (cost 12) impede qualquer login futuro após anonimização.
 *   - Revoga todos os refresh tokens ativos do usuário antes de anonimizar.
 *   - Login gerado automaticamente a partir do nome (nome.sobrenome).
 *   - Reset de senha gera senha temporária e força primeiro_acesso = true.
 */
import { randomInt, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NotFoundError, ForbiddenError, ConflictError } from '@shared/domain/errors';
import { authRepository } from '@modules/auth/auth.repository';
import { usuariosRepository, type AnonimizacaoResult, type UsuarioPublico } from './usuarios.repository';

export interface CreateUsuarioInput {
  nome: string;
  email: string;
  perfil: 'master' | 'user';
}

export interface UpdateUsuarioInput {
  nome?: string;
  perfil?: 'master' | 'user';
  status?: 'active' | 'blocked';
}

export interface ResetPasswordResult {
  senhaTempOraria: string;
}

/** Derives login from full name: "Maria Silva" → "maria.silva". */
function deriveLogin(nome: string): string {
  const parts = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length >= 2
    ? `${parts[0]}.${parts[parts.length - 1]}`
    : parts[0] || 'usuario';
}

/** Generates a strong temporary password (10 chars). */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const nums = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + nums + special;
  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    nums[randomInt(nums.length)],
    special[randomInt(special.length)],
  ];
  for (let i = 4; i < 10; i++) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const usuariosService = {
  async list(): Promise<UsuarioPublico[]> {
    return usuariosRepository.list();
  },

  async create(input: CreateUsuarioInput): Promise<{ usuario: UsuarioPublico; senhaTempOraria: string }> {
    const emailLower = input.email.toLowerCase().trim();

    if (await usuariosRepository.emailExists(emailLower)) {
      throw new ConflictError('E-mail já cadastrado');
    }

    // Build unique login
    let login = deriveLogin(input.nome);
    let suffix = 2;
    while (await usuariosRepository.loginExists(login)) {
      login = `${deriveLogin(input.nome)}${suffix++}`;
    }

    const senhaTempOraria = generateTempPassword();
    const senhaHash = await bcrypt.hash(senhaTempOraria, 12);

    const usuario = await usuariosRepository.create({
      login,
      email: emailLower,
      nome: input.nome.trim(),
      perfil: input.perfil,
      senhaHash,
    });

    return { usuario, senhaTempOraria };
  },

  async update(id: string, input: UpdateUsuarioInput, requestorId: string): Promise<UsuarioPublico> {
    const target = await usuariosRepository.findById(id);
    if (!target || target.excluido_em !== null) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Prevent demoting or blocking self
    if (id === requestorId && (input.status === 'blocked' || input.perfil === 'user')) {
      throw new ForbiddenError('Não é permitido alterar a própria role ou bloquear a própria conta');
    }

    // Only masters can change another user's perfil to master
    // (enforced at route level via requirePerfil, but guard here too)
    if (target.perfil === 'master' && input.perfil === 'user' && id === requestorId) {
      throw new ForbiddenError('Não é permitido rebaixar a própria conta de master');
    }

    const updated = await usuariosRepository.update(id, input);
    if (!updated) throw new NotFoundError('Usuário não encontrado');
    return updated;
  },

  async delete(id: string, requestorId: string): Promise<void> {
    if (id === requestorId) {
      throw new ForbiddenError('Não é permitido excluir a própria conta');
    }

    const target = await usuariosRepository.findById(id);
    if (!target || target.excluido_em !== null) {
      throw new NotFoundError('Usuário não encontrado');
    }
    if (target.perfil === 'master') {
      throw new ForbiddenError('Não é permitido excluir conta master');
    }

    await authRepository.revokeAllUserRefreshTokens(id, 'usuario_excluido');
    const deleted = await usuariosRepository.softDelete(id);
    if (!deleted) throw new NotFoundError('Usuário não encontrado');
  },

  async resetPassword(id: string): Promise<ResetPasswordResult> {
    const target = await usuariosRepository.findById(id);
    if (!target || target.excluido_em !== null) {
      throw new NotFoundError('Usuário não encontrado');
    }

    const senhaTempOraria = generateTempPassword();
    const senhaHash = await bcrypt.hash(senhaTempOraria, 12);

    await authRepository.revokeAllUserRefreshTokens(id, 'reset_senha_admin');
    const ok = await usuariosRepository.resetPassword(id, senhaHash);
    if (!ok) throw new NotFoundError('Usuário não encontrado');

    return { senhaTempOraria };
  },

  async anonimizarLgpd(
    targetId: string,
    requestorId: string,
  ): Promise<AnonimizacaoResult> {
    if (targetId === requestorId) {
      throw new ForbiddenError('Não é permitido anonimizar a própria conta');
    }

    const usuario = await usuariosRepository.findById(targetId);
    if (!usuario) {
      throw new NotFoundError('Usuário não encontrado');
    }

    if (usuario.excluido_em !== null) {
      throw new ForbiddenError('Usuário já foi anonimizado anteriormente');
    }

    await authRepository.revokeAllUserRefreshTokens(targetId, 'anonimize_lgpd');

    const timestamp = Date.now();
    const uuid = randomUUID();
    const senhaAleatoria = randomBytes(32).toString('hex');
    const senhaHash = await bcrypt.hash(senhaAleatoria, 12);

    return usuariosRepository.anonimizar(targetId, {
      email: `anonimo-${uuid}@deleted.local`,
      nome: 'Usuário Anonimizado',
      login: `anon_${timestamp}`,
      senhaHash,
    });
  },
};

/** Exportado para testes. */
export const _internals = {
  usuariosService,
  deriveLogin,
  generateTempPassword,
};
