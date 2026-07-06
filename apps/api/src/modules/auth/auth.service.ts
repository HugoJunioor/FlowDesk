/**
 * Service do Auth — regra de negócio pura.
 *
 * Responsável por:
 *   - Login (validar credenciais, gerar tokens, registrar refresh)
 *   - Refresh (validar refresh, gerar novo par com rotação)
 *   - Logout (revogar refresh)
 *   - Change password (com validação da senha atual)
 *   - Lockout em memória (5 tentativas → 15min)
 *
 * Convenções:
 *   - Access token JWT HS256, ttl curto (15min default)
 *   - Refresh token: opaco aleatório 32 bytes hex, persistido SHA-256 no banco
 *   - Senha hash: bcrypt (cost 12)
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { UnauthorizedError, ForbiddenError, ValidationError } from '@shared/domain/errors';
import { authRepository, type UsuarioRow } from './auth.repository';
import type { AuthResponse, AuthenticatedUser, ChangePasswordInput, LoginInput } from './auth.dto';
import type { JwtAccessPayload } from './auth.types';

// ===== Lockout em memória =====
// 5 tentativas em janela de 15min = lockout. Por simplicidade e baixa escala,
// armazenamos em Map. Se escalar, migrar pra Redis.
const LOCKOUT_MAX = 5;
const LOCKOUT_WINDOW_MS = 15 * 60_000;
interface LockoutEntry {
  count: number;
  firstFailAt: number;
  blockedUntil?: number;
}
const lockouts = new Map<string, LockoutEntry>();

function checkLockout(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const entry = lockouts.get(key);
  if (!entry) return { allowed: true };
  const now = Date.now();
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }
  // Janela expirou? Reset
  if (now - entry.firstFailAt > LOCKOUT_WINDOW_MS) {
    lockouts.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = lockouts.get(key);
  if (!entry || now - entry.firstFailAt > LOCKOUT_WINDOW_MS) {
    lockouts.set(key, { count: 1, firstFailAt: now });
    return;
  }
  entry.count++;
  if (entry.count >= LOCKOUT_MAX) {
    entry.blockedUntil = now + LOCKOUT_WINDOW_MS;
  }
}

function clearLockout(key: string): void {
  lockouts.delete(key);
}

// ===== Tokens =====

function ttlToSeconds(ttl: string): number {
  // Aceita formatos como "15m", "7d", "3600" (segundos)
  const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!m) return 900;
  const n = Number(m[1]);
  const unit = m[2] ?? 's';
  switch (unit) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return n;
  }
}

function generateAccessToken(user: UsuarioRow): { token: string; expiresIn: number } {
  const payload: Omit<JwtAccessPayload, 'iat' | 'exp'> = {
    sub: user.id,
    login: user.login,
    perfil: user.perfil,
  };
  const expiresIn = ttlToSeconds(env.JWT_ACCESS_TTL);
  const token = jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn,
  });
  return { token, expiresIn };
}

function generateRefreshToken(): { plain: string; hash: string; expiresAt: Date } {
  const plain = crypto.randomBytes(32).toString('hex'); // 64 chars hex
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  const ttl = ttlToSeconds(env.JWT_REFRESH_TTL);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  return { plain, hash, expiresAt };
}

function hashRefresh(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

// ===== Montagem do AuthenticatedUser =====

async function buildAuthenticatedUser(user: UsuarioRow): Promise<AuthenticatedUser> {
  const [grupos, permissoes] = await Promise.all([
    authRepository.listUserGroups(user.id),
    authRepository.listUserPermissions(user.id),
  ]);
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
    status: user.status,
    primeiroAcesso: user.primeiro_acesso,
    grupos,
    permissoes,
    themePreferences: user.theme_preferences ?? null,
    language: user.language ?? null,
  };
}

// ===== Public API =====

export interface LoginContext {
  userAgent?: string;
  ip?: string;
}

export interface LoginResult {
  auth: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export const authService = {
  async login(input: LoginInput, ctx: LoginContext = {}): Promise<LoginResult> {
    const lockoutKey = input.login.toLowerCase().trim();
    const lockState = checkLockout(lockoutKey);
    if (!lockState.allowed) {
      throw new ForbiddenError(
        `Muitas tentativas falhas. Tente novamente em ${Math.ceil((lockState.retryAfterSeconds ?? 900) / 60)} minutos.`,
      );
    }

    const user = await authRepository.findUserByLogin(lockoutKey);
    if (!user) {
      recordFailedLogin(lockoutKey);
      throw new UnauthorizedError('Usuário ou senha inválidos');
    }
    if (user.status === 'blocked') {
      throw new ForbiddenError('Conta bloqueada. Contate o administrador.');
    }

    const ok = await bcrypt.compare(input.senha, user.senha_hash);
    if (!ok) {
      recordFailedLogin(lockoutKey);
      throw new UnauthorizedError('Usuário ou senha inválidos');
    }

    clearLockout(lockoutKey);

    const { token: accessToken, expiresIn } = generateAccessToken(user);
    const refresh = generateRefreshToken();

    await authRepository.createRefreshToken({
      usuarioId: user.id,
      tokenHash: refresh.hash,
      expiraEm: refresh.expiresAt,
      userAgentResumo: ctx.userAgent?.slice(0, 200),
      ip: ctx.ip,
    });

    const authUser = await buildAuthenticatedUser(user);

    return {
      auth: { accessToken, expiresIn, usuario: authUser },
      refreshToken: refresh.plain,
      refreshExpiresAt: refresh.expiresAt,
    };
  },

  async refresh(refreshTokenPlain: string, ctx: LoginContext = {}): Promise<LoginResult> {
    if (!refreshTokenPlain) {
      throw new UnauthorizedError('Refresh token ausente');
    }
    const tokenHash = hashRefresh(refreshTokenPlain);
    const stored = await authRepository.findRefreshTokenByHash(tokenHash);
    if (!stored) throw new UnauthorizedError('Refresh token inválido');
    if (stored.revogado_em) throw new UnauthorizedError('Refresh token revogado');
    if (stored.expira_em.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token expirado');
    }

    const user = await authRepository.findUserById(stored.usuario_id);
    if (!user || user.status === 'blocked') {
      // Revoga preventivamente
      await authRepository.revokeRefreshToken(tokenHash, 'usuario_indisponivel');
      throw new UnauthorizedError('Sessão inválida');
    }

    // Rotação: revoga o atual e cria um novo
    await authRepository.revokeRefreshToken(tokenHash, 'rotacionado');
    const newRefresh = generateRefreshToken();
    await authRepository.createRefreshToken({
      usuarioId: user.id,
      tokenHash: newRefresh.hash,
      expiraEm: newRefresh.expiresAt,
      userAgentResumo: ctx.userAgent?.slice(0, 200),
      ip: ctx.ip,
    });

    const { token: accessToken, expiresIn } = generateAccessToken(user);
    const authUser = await buildAuthenticatedUser(user);

    return {
      auth: { accessToken, expiresIn, usuario: authUser },
      refreshToken: newRefresh.plain,
      refreshExpiresAt: newRefresh.expiresAt,
    };
  },

  async logout(refreshTokenPlain: string | undefined): Promise<void> {
    if (!refreshTokenPlain) return; // logout idempotente
    const tokenHash = hashRefresh(refreshTokenPlain);
    await authRepository.revokeRefreshToken(tokenHash, 'logout_explicito');
  },

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedError('Sessão inválida');

    const ok = await bcrypt.compare(input.senhaAtual, user.senha_hash);
    if (!ok) throw new UnauthorizedError('Senha atual incorreta');

    if (input.senhaAtual === input.novaSenha) {
      throw new ValidationError('Nova senha deve ser diferente da atual');
    }

    const novaHash = await bcrypt.hash(input.novaSenha, 12);
    await authRepository.updatePassword(userId, novaHash);
    // Revoga todas as sessões — força re-login nos outros devices
    await authRepository.revokeAllUserRefreshTokens(userId, 'mudanca_senha');
  },

  async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedError('Sessão inválida');
    return buildAuthenticatedUser(user);
  },
};

/** Exportado pra testes. */
export const _internals = {
  hashRefresh,
  ttlToSeconds,
  checkLockout,
  recordFailedLogin,
  clearLockout,
  resetLockouts: (): void => lockouts.clear(),
};
