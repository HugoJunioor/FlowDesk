import { SlackDemand } from "@/types/demand";

/** Demandas de conciliação e remessa SITEF não contam no SLA de 1ª resposta */
export function isExcludedFromFirstResponseSla(d: SlackDemand): boolean {
  const title = d.title.toLowerCase();
  const workflow = d.workflow.toLowerCase();
  return (
    workflow.includes("concilia") || title.includes("concilia") ||
    workflow.includes("remessa") || title.includes("remessa sitef") || title.includes("remessa tef")
  );
}

/**
 * Calcula minutos uteis entre duas datas
 * Horario comercial: Seg-Sex 8h-18h (10h/dia = 600min/dia)
 * Exclui feriados nacionais, estaduais (SP) e municipais (Campinas)
 */

const START_HOUR = 8;
const END_HOUR = 18;
const MINUTES_PER_DAY = (END_HOUR - START_HOUR) * 60; // 600

/**
 * Feriados Campinas/SP por ano.
 * Formato: "YYYY-MM-DD" em horario local (BRT).
 * Inclui nacionais, estaduais (SP) e municipais (Campinas).
 * Pontos facultativos amplamente adotados (Carnaval, Corpus Christi) tambem entram.
 */
const HOLIDAYS: Record<number, Set<string>> = {
  2026: new Set([
    "2026-01-01", // Confraternizacao Universal
    "2026-02-16", // Carnaval (segunda)
    "2026-02-17", // Carnaval (terca)
    "2026-04-03", // Sexta-feira Santa
    "2026-04-21", // Tiradentes
    "2026-05-01", // Dia do Trabalho
    "2026-06-04", // Corpus Christi
    "2026-07-09", // Revolucao Constitucionalista (SP)
    "2026-08-12", // Feriado municipal Campinas
    "2026-09-07", // Independencia do Brasil
    "2026-10-12", // Nossa Senhora Aparecida
    "2026-11-02", // Finados
    "2026-11-20", // Consciencia Negra
    "2026-12-08", // Nossa Senhora da Conceicao (Campinas)
    "2026-12-25", // Natal
  ]),
};

function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = HOLIDAYS[year];
  if (!holidays) return false;
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return holidays.has(`${year}-${mm}-${dd}`);
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !isHoliday(date);
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

/**
 * SLA de primeira resposta: minutos uteis entre criacao e primeira resposta da equipe.
 * Se slaFirstResponseOverride for fornecido (dados historicos da planilha), usa diretamente.
 * Retorna null se nao ha resposta da equipe.
 */
export function getFirstResponseMinutes(createdAt: string, threadReplies: { timestamp: string; isTeamMember: boolean }[], slaFirstResponseOverride?: number | null): number | null {
  // Dados historicos com SLA pre-calculado da planilha
  if (slaFirstResponseOverride !== undefined && slaFirstResponseOverride !== null) {
    return slaFirstResponseOverride;
  }

  const teamReplies = threadReplies
    .filter((r) => r.isTeamMember)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (teamReplies.length === 0) return null;

  return getBusinessMinutesBetween(new Date(createdAt), new Date(teamReplies[0].timestamp));
}

/**
 * SLA de resolucao: minutos uteis entre criacao e conclusao.
 * Retorna null se nao foi concluida.
 */
export function getResolutionMinutes(createdAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  return getBusinessMinutesBetween(new Date(createdAt), new Date(completedAt));
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
