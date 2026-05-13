/**
 * Cron de SLA reminders. setInterval simples, sem dependência externa.
 *
 * Pra escalas maiores (>500 demandas abertas ou >50 usuários), migrar
 * pra BullMQ + Redis. Aqui o overhead é desprezível.
 *
 * Se a env SLA_CRON_ENABLED=false (default em dev), não inicia. Em prod
 * recomenda-se ativar via .env.
 *
 * Reentrância: lock booleano impede dois ciclos sobrepostos se o anterior
 * demorar mais que o intervalo.
 */
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';
import { runSlaReminderCycle } from './sla.engine';

let running = false;
let timer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  if (running) {
    logger.warn('SLA cycle anterior ainda em execucao, pulando este tick');
    return;
  }
  running = true;
  try {
    await runSlaReminderCycle();
  } catch (err) {
    logger.error({ err }, 'sla cron falhou');
  } finally {
    running = false;
  }
}

export function startSlaCron(): void {
  if (!env.SLA_CRON_ENABLED) {
    logger.info('SLA_CRON_ENABLED=false — cron de SLA nao sera iniciado');
    return;
  }
  if (timer) return; // já iniciado
  const intervalMs = env.SLA_CRON_INTERVAL_SECONDS * 1000;
  logger.info({ intervalSeconds: env.SLA_CRON_INTERVAL_SECONDS }, 'iniciando cron de SLA');

  // Primeiro tick imediato, depois a cada intervalo
  void tick();
  timer = setInterval(() => void tick(), intervalMs);
  // .unref() pra cron não impedir o processo de encerrar
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopSlaCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
