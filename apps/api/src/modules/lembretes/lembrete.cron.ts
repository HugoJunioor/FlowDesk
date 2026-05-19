/**
 * Cron do lembrete diário — 9h em dias úteis (timezone America/Sao_Paulo).
 *
 * Usa setInterval de 1 minuto e checa se é hora de rodar, sem dependência
 * de libs externas de cron (mesmo padrão do sla.cron.ts).
 *
 * Só inicia se DAILY_REMINDER_ENABLED=true.
 */
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';
import { runLembreteDiarioCycle } from './lembrete.service';

const TARGET_HOUR_BRT = 9; // 9h BRT = UTC-3 = 12h UTC
const CHECK_INTERVAL_MS = 60_000; // verifica a cada minuto

let timer: NodeJS.Timeout | null = null;
let lastRanDate: string | null = null; // "YYYY-MM-DD" — evita rodar 2x no mesmo dia
let running = false;

function todayInBrt(): string {
  // Retorna "YYYY-MM-DD" no fuso de São Paulo
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function currentHourInBrt(): number {
  return Number(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }),
  );
}

function isWeekdayBrt(): boolean {
  const day = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
  });
  return day !== 'Saturday' && day !== 'Sunday';
}

async function tick(): Promise<void> {
  if (!isWeekdayBrt()) return;
  if (currentHourInBrt() !== TARGET_HOUR_BRT) return;

  const today = todayInBrt();
  if (lastRanDate === today) return; // já rodou hoje

  if (running) {
    logger.warn('lembrete cycle anterior ainda em execucao, pulando tick');
    return;
  }

  lastRanDate = today;
  running = true;
  try {
    await runLembreteDiarioCycle();
  } catch (err) {
    logger.error({ err }, 'lembrete diario cron falhou');
  } finally {
    running = false;
  }
}

export function startLembreteCron(): void {
  if (!env.DAILY_REMINDER_ENABLED) {
    logger.info('DAILY_REMINDER_ENABLED=false — cron de lembrete diario nao sera iniciado');
    return;
  }
  if (timer) return;

  logger.info('iniciando cron de lembrete diario (verifica a cada 1min, roda 9h BRT dias uteis)');
  timer = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopLembreteCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Exposto para trigger manual — não verifica hora nem dia. */
export async function triggerManual(): Promise<ReturnType<typeof runLembreteDiarioCycle>> {
  if (running) throw new Error('Cycle já em execução');
  running = true;
  try {
    return await runLembreteDiarioCycle();
  } finally {
    running = false;
  }
}
