/**
 * Integração com Sentry — captura de erros + traces.
 *
 * 100% opt-in: sem SENTRY_DSN no .env, todas as funções viram no-op.
 * Em prod com DSN configurada:
 *   - Captura uncaughtException, unhandledRejection
 *   - Captura erros que passam pelo error-handler middleware
 *   - Sample rate de traces configurável (default 10%)
 *
 * Tags automáticas:
 *   - request_id (do middleware request-id)
 *   - user_id, user_perfil (quando autenticado)
 *
 * Não envia dados sensíveis: senhas, tokens e cookies já passam pelo
 * redact do logger e nunca chegam aqui. Para garantir, configuramos
 * beforeSend pra remover authorization, cookie e password de qualquer
 * payload.
 */
import * as Sentry from '@sentry/node';
import { env } from '@config/env';
import type { Request } from 'express';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!env.SENTRY_DSN) return; // opt-out completo

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Default integrations ja capturam uncaughtException/unhandledRejection
    beforeSend(event) {
      // Defesa em profundidade: remove campos sensíveis
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        delete h['authorization'];
        delete h['Authorization'];
        delete h['cookie'];
        delete h['Cookie'];
        delete h['x-flowdesk-token'];
      }
      // Senha em body de erros de auth
      const data = event.request?.data as Record<string, unknown> | undefined;
      if (data && typeof data === 'object') {
        if ('senha' in data) data.senha = '[REDACTED]';
        if ('password' in data) data.password = '[REDACTED]';
        if ('novaSenha' in data) data.novaSenha = '[REDACTED]';
        if ('senhaAtual' in data) data.senhaAtual = '[REDACTED]';
      }
      return event;
    },
  });

  initialized = true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Captura um erro com contexto enriquecido pelo request.
 * Chamado pelo error-handler quando algo dá 500.
 */
export function captureWithContext(err: unknown, req?: Request): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (req) {
      scope.setTag('request_id', req.id ?? 'unknown');
      scope.setTag('method', req.method);
      scope.setTag('route', req.route?.path ?? req.path);
      if (req.user) {
        scope.setUser({
          id: req.user.id,
          username: req.user.login,
          perfil: req.user.perfil,
        });
      }
    }
    Sentry.captureException(err);
  });
}
