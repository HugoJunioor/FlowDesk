/**
 * Bootstrap do servidor HTTP.
 *
 * Roda o Express criado em app.ts, captura SIGTERM/SIGINT pra shutdown
 * limpo (drena conexoes do pool antes de morrer).
 */
// Sentry precisa ser inicializado ANTES de qualquer import que possa
// gerar erros — por isso fica antes de createApp.
import { initSentry } from '@shared/observability/sentry';
initSentry();

import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';
import { closePool } from '@config/database';
import { startSlaCron, stopSlaCron } from '@modules/sla/sla.cron';
import { startLembreteCron, stopLembreteCron } from '@modules/lembretes/lembrete.cron';

async function main(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `🚀 FlowDesk API rodando em http://localhost:${env.PORT}`,
    );
    // Cron de SLA reminders (no-op se SLA_CRON_ENABLED=false)
    startSlaCron();
    // Cron de lembrete diário por e-mail (no-op se DAILY_REMINDER_ENABLED=false)
    startLembreteCron();
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Recebido sinal de desligamento, encerrando...');
    stopSlaCron();
    stopLembreteCron();
    server.close(async () => {
      try {
        await closePool();
        logger.info('Pool do Postgres encerrado. Bye!');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Erro ao encerrar pool');
        process.exit(1);
      }
    });

    // Hard kill se nao terminar em 10s
    setTimeout(() => {
      logger.warn('Timeout de shutdown atingido, forcando exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandledRejection');
    process.exit(1);
  });
}

void main();
