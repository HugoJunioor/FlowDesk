/**
 * Sentry init pro frontend — 100% opt-in via VITE_SENTRY_DSN.
 *
 * Sem DSN, todas as funções viram no-op (zero overhead, zero data leak).
 * Em prod com DSN setada:
 *   - Captura uncaught errors + unhandled promises
 *   - Sample rate de traces configurável (default 10%)
 *   - replaysSessionSampleRate: 0 (desligado por padrão — privacy)
 *
 * Não usa Session Replay nem Performance Profiling por padrão (dados
 * sensíveis de cliente na tela).
 */
import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) ||
                  (import.meta.env.MODE ?? 'development'),
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Session Replay e Profiling desligados — evita captura acidental
    // de dados sensíveis na tela (clientes, demandas, etc).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      // Defesa em profundidade — remove campos sensíveis se aparecerem
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        delete h['authorization'];
        delete h['Authorization'];
        delete h['cookie'];
      }
      return event;
    },
  });

  initialized = true;
}

export function setSentryUser(user: { id: string; login: string; perfil: string } | null): void {
  if (!initialized) return;
  Sentry.setUser(user ? { id: user.id, username: user.login, perfil: user.perfil } : null);
}

export function isSentryEnabled(): boolean {
  return initialized;
}
