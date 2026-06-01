/**
 * Engine de lembretes SLA — dispara notificacoes "SLA vencendo" / "SLA
 * estourado" baseado nas preferencias do usuario.
 *
 * Rodada no polling do sino (a cada 30s). Pra cada demanda atribuida ao
 * user logado:
 *
 * 1. Calcula minutos uteis ate o dueDate
 * 2. Compara com preferencias do user (p1Hours/p2Hours/p3Hours)
 * 3. Se SLA esta dentro do range de aviso E ainda nao notificou → dispara
 *    "demand_due_soon"
 * 4. Se SLA estourou E ainda nao notificou → dispara "demand_overdue"
 *
 * Anti-spam: cada (demandId + tipoAviso) eh registrado em localStorage
 * pra nao avisar repetidamente.
 */
import { SlackDemand, PRIORITY_CONFIG } from "@/types/demand";
import { NotificationPreferences } from "@/types/notification";
import { getBusinessMinutesBetween } from "./businessHours";
import { notify } from "./notificationEvents";
import { FlowDeskUser } from "@/types/auth";

const STORAGE_KEY = "fd_sla_reminders_sent";

interface SentRecord {
  /** Demandas que ja recebiam aviso "due_soon" */
  dueSoon: string[];
  /** Demandas que ja recebiam aviso "overdue" */
  overdue: string[];
}

function loadSent(): SentRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dueSoon: [], overdue: [] };
    const parsed = JSON.parse(raw);
    return {
      dueSoon: Array.isArray(parsed.dueSoon) ? parsed.dueSoon : [],
      overdue: Array.isArray(parsed.overdue) ? parsed.overdue : [],
    };
  } catch {
    return { dueSoon: [], overdue: [] };
  }
}

function saveSent(rec: SentRecord): void {
  try {
    // Limita o tamanho — mantem so os 200 mais recentes pra nao crescer indefinido
    const trim = (arr: string[]) => arr.slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      dueSoon: trim(rec.dueSoon),
      overdue: trim(rec.overdue),
    }));
  } catch { /* storage cheio */ }
}

/**
 * Quantas horas antes do vencimento avisar, conforme prioridade.
 * Retorna 0 = nao avisar; >0 = avisar quando faltarem X horas ou menos.
 */
function hoursBeforeForPriority(
  priority: SlackDemand["priority"],
  prefs: NotificationPreferences,
): number {
  if (priority === "p1") return prefs.slaReminders.p1Hours;
  if (priority === "p2") return prefs.slaReminders.p2Hours;
  if (priority === "p3") return prefs.slaReminders.p3Hours;
  return 0;
}

/**
 * Filtra demandas que sao "do user logado" — solicitante ou assignee.
 * Comparacao por nome (case-insensitive). Esse eh um proxy do "tem
 * relacao com voce" — pra Infra o assignee eh fixo (operador default
 * configurado em runtime), mas o solicitante pode ser qualquer um.
 */
function isUsersConcern(demand: SlackDemand, user: FlowDeskUser): boolean {
  const userName = (user.name || "").toLowerCase();
  const assignee = (demand.assignee?.name || "").toLowerCase();
  const requester = (demand.requester?.name || "").toLowerCase();
  return assignee === userName || requester === userName;
}

/**
 * Calcula minutos uteis restantes ate o dueDate. Negativo = ja vencido.
 */
function minutesToDueDate(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  if (due >= now) {
    return getBusinessMinutesBetween(now, due);
  }
  // Ja vencido — retorna negativo (apenas pra sinalizar overdue)
  return -1;
}

interface RunOpts {
  user: FlowDeskUser;
  prefs: NotificationPreferences;
  demands: SlackDemand[];
}

/**
 * Roda a checagem e dispara as notificacoes necessarias.
 * Idempotente: nao avisa duas vezes pra mesma demanda+tipo.
 */
export async function runSlaReminderCheck({ user, prefs, demands }: RunOpts): Promise<void> {
  if (!user.email) return;

  // Eventos desligados nas prefs? aborta
  const dueSoonEnabled = prefs.events.demand_due_soon !== false;
  const overdueEnabled = prefs.events.demand_overdue !== false;
  if (!dueSoonEnabled && !overdueEnabled) return;

  const sent = loadSent();
  const newDueSoon = new Set(sent.dueSoon);
  const newOverdue = new Set(sent.overdue);
  let changed = false;

  for (const d of demands) {
    // Filtros basicos: precisa ter dueDate, nao pode estar concluida/expirada
    if (!d.dueDate) continue;
    if (d.status === "concluida" || d.status === "expirada") continue;
    if (d.priority === "sem_classificacao") continue;
    if (!PRIORITY_CONFIG[d.priority]?.sla) continue;
    // So mexe em demandas do user logado
    if (!isUsersConcern(d, user)) continue;

    const minsLeft = minutesToDueDate(d.dueDate);
    const isOverdue = minsLeft < 0;

    if (isOverdue && overdueEnabled && !newOverdue.has(d.id)) {
      // Dispara "SLA estourado"
      await notify({
        userEmail: user.email,
        event: "demand_overdue",
        source: d.source === "internal" ? "infra" : "slack",
        demandId: d.id,
        title: d.title,
        message: `SLA estourado · prazo era ${new Date(d.dueDate).toLocaleString("pt-BR")}`,
      });
      newOverdue.add(d.id);
      changed = true;
      continue; // ja overdue, nao precisa testar "due_soon"
    }

    if (!isOverdue && dueSoonEnabled && !newDueSoon.has(d.id)) {
      // Esta dentro do range de aviso?
      const hoursBefore = hoursBeforeForPriority(d.priority, prefs);
      if (hoursBefore <= 0) continue;
      const thresholdMins = hoursBefore * 60;
      if (minsLeft <= thresholdMins) {
        await notify({
          userEmail: user.email,
          event: "demand_due_soon",
          source: d.source === "internal" ? "infra" : "slack",
          demandId: d.id,
          title: d.title,
          message: `Vence em ${formatTimeLeft(minsLeft)} (prazo: ${new Date(d.dueDate).toLocaleString("pt-BR")})`,
        });
        newDueSoon.add(d.id);
        changed = true;
      }
    }
  }

  if (changed) {
    saveSent({
      dueSoon: Array.from(newDueSoon),
      overdue: Array.from(newOverdue),
    });
  }
}

function formatTimeLeft(mins: number): string {
  if (mins <= 0) return "menos de 1min";
  if (mins < 60) return `${Math.round(mins)}min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Limpa o registro de demandas avisadas — util quando user quer "resetar"
 * pra receber avisos de novo. Pode ser exposto como botao em /configuracoes.
 */
export function clearSlaReminderHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
