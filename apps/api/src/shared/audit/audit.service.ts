/**
 * Service de auditoria.
 *
 * Helper de alto nível pra registrar eventos. Sanitiza payload removendo
 * campos sensíveis antes de gravar (defesa em profundidade — o cliente
 * nunca deveria ter mandado, mas se mandou, não vai parar no audit).
 *
 * O write é fire-and-forget: se a auditoria falhar, NÃO quebra a request.
 * Falhas de audit aparecem nos logs do Pino (logger.error).
 */
import type { Request } from 'express';
import { logger } from '@shared/logging/logger';
import { auditRepository, type AuditEntry } from './audit.repository';

const SENSITIVE_KEYS = new Set([
  'senha', 'password', 'novaSenha', 'senhaAtual', 'passwordHash',
  'senha_hash', 'token', 'accessToken', 'refreshToken', 'authorization',
]);

function sanitize<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(sanitize) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitize(v);
    }
  }
  return out as T;
}

interface LogArgs extends Omit<AuditEntry, 'usuarioEmail' | 'ip' | 'userAgent' | 'requestId'> {
  req?: Request;
  /** Sobrescreve usuarioEmail (ex: ação de master sobre outro user) */
  usuarioEmail?: string | null;
}

export const auditService = {
  /**
   * Registra um evento de auditoria. Fire-and-forget: falhas vão pro
   * logger mas não propagam ao caller.
   */
  log(args: LogArgs): void {
    const entry: AuditEntry = {
      usuarioEmail:
        args.usuarioEmail !== undefined ? args.usuarioEmail :
        args.req?.user?.email ?? null,
      recurso: args.recurso,
      recursoId: args.recursoId ?? null,
      acao: args.acao,
      payloadAntes: args.payloadAntes !== undefined ? sanitize(args.payloadAntes) : undefined,
      payloadDepois: args.payloadDepois !== undefined ? sanitize(args.payloadDepois) : undefined,
      ip: args.req?.ip ?? null,
      userAgent: args.req?.header('user-agent') ?? null,
      requestId: args.req?.id ?? null,
    };

    // Não esperamos — fire-and-forget. Erro não quebra fluxo principal.
    auditRepository.log(entry).catch((err) => {
      logger.error({ err, entry: { recurso: entry.recurso, acao: entry.acao } },
        'audit log falhou — operação principal continua');
    });
  },
};
