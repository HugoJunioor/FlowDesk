/**
 * Calcula minutos uteis entre duas datas
 * Horario comercial: Seg-Sex 8h-18h (10h/dia = 600min/dia)
 */

const START_HOUR = 8;
const END_HOUR = 18;
const MINUTES_PER_DAY = (END_HOUR - START_HOUR) * 60; // 600

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function getBusinessMinutesInDay(date: Date, fromMinute: number, toMinute: number): number {
  if (!isBusinessDay(date)) return 0;
  const dayStart = START_HOUR * 60;
  const dayEnd = END_HOUR * 60;
  const from = Math.max(fromMinute, dayStart);
  const to = Math.min(toMinute, dayEnd);
  return Math.max(0, to - from);
}

export function getBusinessMinutesBetween(start: Date, end: Date): number {
  if (end <= start) return 0;

  const s = new Date(start);
  const e = new Date(end);

  // Same day
  if (
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate()
  ) {
    return getBusinessMinutesInDay(
      s,
      s.getHours() * 60 + s.getMinutes(),
      e.getHours() * 60 + e.getMinutes()
    );
  }

  let total = 0;

  // First day
  total += getBusinessMinutesInDay(s, s.getHours() * 60 + s.getMinutes(), END_HOUR * 60);

  // Full days in between
  const nextDay = new Date(s);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  const lastDay = new Date(e);
  lastDay.setHours(0, 0, 0, 0);

  const current = new Date(nextDay);
  while (current < lastDay) {
    if (isBusinessDay(current)) {
      total += MINUTES_PER_DAY;
    }
    current.setDate(current.getDate() + 1);
  }

  // Last day
  total += getBusinessMinutesInDay(e, START_HOUR * 60, e.getHours() * 60 + e.getMinutes());

  return total;
}

/**
 * Adiciona N horas UTEIS a uma data.
 * Ex: addBusinessHours("2026-04-06T17:00", 24) = 2026-04-09T11:00
 * (1h seg 17-18 + 10h ter + 10h qua + 3h qui 8-11 = 24h)
 */
export function addBusinessHours(startDate: Date, hours: number): Date {
  let remainingMinutes = hours * 60;
  const d = new Date(startDate);

  // If outside business hours, move to next business start
  if (!isBusinessDay(d) || d.getHours() >= END_HOUR) {
    // Move to next day
    d.setDate(d.getDate() + 1);
    d.setHours(START_HOUR, 0, 0, 0);
    while (!isBusinessDay(d)) {
      d.setDate(d.getDate() + 1);
    }
  } else if (d.getHours() < START_HOUR) {
    d.setHours(START_HOUR, 0, 0, 0);
  }

  while (remainingMinutes > 0) {
    if (!isBusinessDay(d)) {
      d.setDate(d.getDate() + 1);
      d.setHours(START_HOUR, 0, 0, 0);
      continue;
    }

    const currentMinute = d.getHours() * 60 + d.getMinutes();
    const endOfDayMinute = END_HOUR * 60;
    const availableToday = endOfDayMinute - currentMinute;

    if (remainingMinutes <= availableToday) {
      // Fits in today
      d.setMinutes(d.getMinutes() + remainingMinutes);
      remainingMinutes = 0;
    } else {
      // Consume rest of today, move to next day
      remainingMinutes -= availableToday;
      d.setDate(d.getDate() + 1);
      d.setHours(START_HOUR, 0, 0, 0);
    }
  }

  return d;
}

export function formatBusinessTime(minutes: number): string {
  if (minutes <= 0) return "0m";

  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const remainingMinutes = minutes % MINUTES_PER_DAY;
  const hours = Math.floor(remainingMinutes / 60);
  const mins = Math.round(remainingMinutes % 60);

  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function getBusinessTimeInfo(createdAt: string, dueDate: string) {
  const now = new Date();
  const created = new Date(createdAt);
  const due = new Date(dueDate);

  const totalBusinessMinutes = getBusinessMinutesBetween(created, due);
  const elapsedBusinessMinutes = getBusinessMinutesBetween(created, now);
  const remainingBusinessMinutes = getBusinessMinutesBetween(now, due);

  const progress = totalBusinessMinutes > 0
    ? Math.min(100, Math.max(0, (elapsedBusinessMinutes / totalBusinessMinutes) * 100))
    : 100;

  const isExpired = remainingBusinessMinutes <= 0;
  const remainingHours = remainingBusinessMinutes / 60;
  const isCritical = !isExpired && remainingHours < 2;
  const isWarning = !isExpired && !isCritical && remainingHours < 4;

  return {
    totalBusinessMinutes,
    elapsedBusinessMinutes,
    remainingBusinessMinutes,
    progress,
    isExpired,
    isCritical,
    isWarning,
    timeText: formatBusinessTime(remainingBusinessMinutes),
  };
}
