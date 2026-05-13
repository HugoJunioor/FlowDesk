/**
 * Service do módulo Usuarios.
 *
 * Responsável por:
 *   - Anonimização LGPD (right-to-be-forgotten): substitui dados PII por
 *     valores anônimos e invalida a conta, preservando o id para FKs.
 *
 * Convenções:
 *   - Senha aleatória bcrypt (cost 12) impede qualquer login futuro.
 *   - Revoga todos os refresh tokens ativos do usuário antes de anonimizar.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NotFoundError, ForbiddenError } from '@shared/domain/errors';
import { authRepository } from '@modules/auth/auth.repository';
import { usuariosRepository, type AnonimizacaoResult } from './usuarios.repository';

export const usuariosService = {
  async anonimizarLgpd(
    targetId: string,
    requestorId: string,
  ): Promise<AnonimizacaoResult> {
    // Impede master de se auto-anonimizar (evitar lockout acidental)
    if (targetId === requestorId) {
      throw new ForbiddenError('Não é permitido anonimizar a própria conta');
    }

    const usuario = await usuariosRepository.findById(targetId);
    if (!usuario) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Impede re-anonimização de conta já excluída
    if (usuario.excluido_em !== null) {
      throw new ForbiddenError('Usuário já foi anonimizado anteriormente');
    }

    // Revoga sessões ativas — impede uso de tokens em circulação
    await authRepository.revokeAllUserRefreshTokens(targetId, 'anonimize_lgpd');

    const timestamp = Date.now();
    const uuid = crypto.randomUUID();

    // Senha aleatória — ninguém sabe, nunca vai logar
    const senhaAleatoria = crypto.randomBytes(32).toString('hex');
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
};
