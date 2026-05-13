/**
 * Cálculo de minutos úteis (Seg-Sex 8h-18h, excluindo feriados BR).
 *
 * Espelha apps/web/src/lib/businessHours.ts. Algoritmo de Páscoa
 * (Meeus/Jones/Butcher) para feriados móveis. Suporta qualquer ano.
 *
 * Lista de feriados: nacionais + estaduais SP + municipais Campinas.
 * Ajuste a região conforme a operação da Just.
 */

const START_HOUR = 8;
const END_HOUR = 18;
const MINUTES_PER_DAY = (END_HOUR - START_HOUR) * 60; // 600

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const holidayCache = new Map<number, Set<string>>();

function holidaysForYear(year: number): Set<string> {
  let cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = computeEaster(year);
  const fixed = [
    `${year}-01-01`, // Confraternização
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Trabalho
    `${year}-07-09`, // Revolução Constitucionalista (SP)
    `${year}-09-07`, // Independência
    `${year}-10-12`, // N. Sra. Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-12-25`, // Natal
  ];
  cached = new Set([
    ...fixed,
    fmt(addDays(easter, -48)), // Carnaval (segunda)
    fmt(addDays(easter, -47)), // Carnaval (terça)
    fmt(addDays(easter, -2)),  // Sexta Santa
    fmt(easter),               // Páscoa
    fmt(addDays(easter, 60)),  // Corpus Christi
  ]);
  holidayCache.set(year, cached);
  return cached;
}

function isHoliday(d: Date): boolean {
  return holidaysForYear(d.getFullYear()).has(fmt(d));
}

function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (isHoliday(d)) return false;
  return true;
}

/**
 * Minutos úteis entre `from` e `to`. `to` < `from` retorna negativo.
 */
export function getBusinessMinutesBetween(from: Date, to: Date): number {
  if (to.getTime() === from.getTime()) return 0;
  const negative = to.getTime() < from.getTime();
  const start = negative ? to : from;
  const end = negative ? from : to;

  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isBusinessDay(cursor)) {
      const dayStart = new Date(cursor);
      dayStart.setHours(START_HOUR, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(END_HOUR, 0, 0, 0);
      const a = cursor > dayStart ? cursor : dayStart;
      const b = end < dayEnd ? end : dayEnd;
      if (b > a) {
        total += (b.getTime() - a.getTime()) / 60000;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return negative ? -total : total;
}

export const _internals = { computeEaster, isHoliday, isBusinessDay, MINUTES_PER_DAY };
