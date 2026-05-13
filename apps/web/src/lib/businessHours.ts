import { SlackDemand } from "@/types/demand";

/**
 * Demandas Sitef/Conciliacao tem fluxo proprio de atendimento:
 * - Inicio do atendimento marcado por reaction de :loading: em qualquer
 *   mensagem da thread (campo serviceStartedAt — implementado na Fase 2)
 * - 1a resposta SLA: 4h uteis ate o emoji ser adicionado
 * - Resolucao SLA: 24h uteis (P3) ate completedAt
 *
 * Esta funcao mantida pra retro-compatibilidade com codigo legacy mas agora
 * retorna sempre false. As novas regras de SLA pra esses tipos sao aplicadas
 * via demandType === 'Sitef' | 'Conciliacao' nos consumers (slaCalculator).
 */
export function isExcludedFromFirstResponseSla(_d: SlackDemand): boolean {
  return false;
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
 * Calculo da Pascoa (algoritmo Meeus/Jones/Butcher) — funciona para qualquer ano.
 * Base para feriados moveis (Carnaval, Sexta Santa, Corpus Christi).
 */
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Marco, 4=Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function fmt(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Gera conjunto de feriados (Campinas/SP) para um ano especifico.
 * Inclui nacionais, estaduais SP e municipais Campinas,
 * + pontos facultativos amplamente adotados (Carnaval, Corpus Christi).
 */
function generateHolidaysForYear(year: number): Set<string> {
  const easter = computeEaster(year);
  return new Set([
    `${year}-01-01`,                // Confraternizacao Universal
    fmt(addDays(easter, -48)),      // Carnaval (segunda)
    fmt(addDays(easter, -47)),      // Carnaval (terca)
    fmt(addDays(easter, -2)),       // Sexta-feira Santa
    `${year}-04-21`,                // Tiradentes
    `${year}-05-01`,                // Dia do Trabalho
    fmt(addDays(easter, 60)),       // Corpus Christi
    `${year}-07-09`,                // Revolucao Constitucionalista (SP)
    `${year}-08-12`,                // Feriado municipal Campinas
    `${year}-09-07`,                // Independencia do Brasil
    `${year}-10-12`,                // Nossa Senhora Aparecida
    `${year}-11-02`,                // Finados
    `${year}-11-15`,                // Proclamacao da Republica
    `${year}-11-20`,                // Consciencia Negra (nacional desde 2024)
    `${year}-12-08`,                // Nossa Senhora da Conceicao (Campinas)
    `${year}-12-25`,                // Natal
  ]);
}

/**
 * Cache de feriados por ano. Preenchido sob demanda.
 * Cobre qualquer ano consultado — nunca "expira".
 */
const HOLIDAY_CACHE: Record<number, Set<string>> = {};

function getHolidaysForYear(year: number): Set<string> {
  if (!HOLIDAY_CACHE[year]) {
    HOLIDAY_CACHE[year] = generateHolidaysForYear(year);
  }
  return HOLIDAY_CACHE[year];
}

function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getHolidaysForYear(year);
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
 * Reply sintetico = gerado pelo sync quando a demanda foi fechada via
 * reaction ✅/🟢 direto na mensagem principal, sem resposta real no thread.
 * Texto comeca com "[✅" e nao representa atendimento humano. Esses replies
 * NAO contam como primeira resposta da equipe (distorceriam a metrica de SLA
 * pra perto de 0 — a reaction acontece ~1s apos createdAt).
 */
function isSyntheticReply(r: { text?: string }): boolean {
  return typeof r.text === "string" && r.text.startsWith("[✅");
}

/**
 * SLA de primeira resposta: minutos uteis entre criacao e primeira resposta da equipe.
 * Se slaFirstResponseOverride for fornecido (dados historicos da planilha), usa diretamente.
 *
 * Pra demandas Sitef/Conciliacao com serviceStartedAt definido (emoji :loading:
 * em alguma reply), considera tambem o tempo da reaction como possivel "primeira
 * resposta" — usa o que vier ANTES (reaction ou reply textual da equipe).
 *
 * Retorna null se nao ha resposta real da equipe (replies sinteticos de reaction
 * sao ignorados — ver isSyntheticReply).
 */
export function getFirstResponseMinutes(
  createdAt: string,
  threadReplies: { timestamp: string; isTeamMember: boolean; text?: string }[],
  slaFirstResponseOverride?: number | null,
  serviceStartedAt?: string | null,
): number | null {
  // Dados historicos com SLA pre-calculado da planilha
  if (slaFirstResponseOverride !== undefined && slaFirstResponseOverride !== null) {
    return slaFirstResponseOverride;
  }

  const teamReplies = threadReplies
    .filter((r) => r.isTeamMember && !isSyntheticReply(r))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const firstReplyTs = teamReplies.length > 0 ? new Date(teamReplies[0].timestamp).getTime() : null;
  const serviceTs = serviceStartedAt ? new Date(serviceStartedAt).getTime() : null;

  // Pega o que vier ANTES entre a primeira reply real da equipe e o inicio
  // de atendimento via :loading:. Se nenhum dos dois existe, retorna null.
  const candidates = [firstReplyTs, serviceTs].filter((t): t is number => t !== null);
  if (candidates.length === 0) return null;
  const effectiveTs = Math.min(...candidates);

  return getBusinessMinutesBetween(new Date(createdAt), new Date(effectiveTs));
}

/**
 * SLA de resolucao: minutos uteis entre criacao e conclusao.
 * Retorna null se nao foi concluida.
 *
 * Heuristica anti-zerado: quando a demanda foi fechada via reaction ✅/🟢
 * direto na mensagem principal SEM resposta real da equipe, o sync gera
 * completedAt = createdAt + 1s (timestamp aproximado, nao real). Resultado
 * eh ~0min, distorcendo metricas. Pra evitar, se o tempo for < 1 minuto E
 * nao houver resposta real da equipe no thread, retorna null (tempo real
 * desconhecido — melhor "sem dado" do que "0min" enganoso).
 */
export function getResolutionMinutes(
  createdAt: string,
  completedAt: string | null,
  threadReplies?: { isTeamMember: boolean; text?: string }[],
): number | null {
  if (!completedAt) return null;
  const minutes = getBusinessMinutesBetween(new Date(createdAt), new Date(completedAt));

  // Heuristica: se < 1 min E nao ha resposta real da equipe -> reply sintetico,
  // tempo real desconhecido. Retorna null pra metrica nao usar valor enganoso.
  if (minutes < 1 && threadReplies) {
    const realTeamReplies = threadReplies.filter(
      (r) => r.isTeamMember && !(typeof r.text === "string" && r.text.startsWith("[✅")),
    );
    if (realTeamReplies.length === 0) return null;
  }

  return minutes;
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
