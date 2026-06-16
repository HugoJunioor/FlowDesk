/**
 * Helpers que disparam notificacoes nos pontos certos do app.
 *
 * Padronizam o conteudo e respeitam preferencias do destinatario.
 * Chamadas inline em hooks/components quando eventos acontecem.
 */
import { apiClient } from "./apiClient";
import {
  NotificationEvent,
  NotificationPreferences,
  DEFAULT_PREFERENCES,
  isEventEnabledForChannel,
  EVENT_LABELS,
} from "@/types/notification";
import { showBrowserNotification, getPermission } from "./browserNotifications";
import { SlackDemand } from "@/types/demand";
import { getCachedUsers, getSession } from "./authStorage";

/**
 * Resolve email do assignee/requester a partir do nome.
 * Tenta primeiro lookup em FlowDesk users (login/email), senao retorna null.
 */
function emailFromName(name: string | undefined): string | null {
  if (!name) return null;
  try {
    const users = getCachedUsers();
    const u = users.find(
      (x) => x.name?.toLowerCase() === name.toLowerCase() ||
             x.login?.toLowerCase() === name.toLowerCase(),
    );
    return u?.email || null;
  } catch {
    return null;
  }
}

/** Carrega preferencias do user com merge nos defaults */
async function loadPrefs(email: string): Promise<NotificationPreferences> {
  try {
    const r = await apiClient.notifications.getPreferences(email);
    if (r.preferences) return r.preferences;
  } catch {
    /* fallback nos defaults */
  }
  return { userEmail: email, ...DEFAULT_PREFERENCES };
}

/**
 * Dispara uma notificacao se o usuario tem o evento habilitado.
 * Atual: so cria no inbox. Push/email vem na fase de canais.
 */
export async function notify(params: {
  userEmail: string;
  event: NotificationEvent;
  source?: "slack" | "infra";
  demandId: string;
  title: string;
  message: string;
  actor?: string;
}): Promise<void> {
  const { userEmail, event } = params;
  if (!userEmail) return;
  try {
    const prefs = await loadPrefs(userEmail);
    // Inbox: respeita master switch + override por canal
    if (prefs.channels.inbox && isEventEnabledForChannel(prefs, "inbox", event)) {
      await apiClient.notifications.create(params);
    }

    // Browser push: dispara local se permitido + canal ligado + evento ligado.
    // So fira pro user logado nesta aba (push aparece no SO local; mandar pra
    // outros users dependeria de Service Worker + Web Push API).
    const session = getSession();
    const currentEmail = session?.user?.email?.toLowerCase();
    const isMyEvent = !!currentEmail && currentEmail === userEmail.toLowerCase();
    if (
      isMyEvent &&
      prefs.channels.browserPush &&
      isEventEnabledForChannel(prefs, "browserPush", event) &&
      getPermission() === "granted"
    ) {
      const label = EVENT_LABELS[event]?.label || "Notificação";
      const url = params.demandId
        ? `/demandas?openId=${encodeURIComponent(params.demandId)}`
        : undefined;
      showBrowserNotification({
        title: `FlowDesk · ${label}`,
        body: `${params.title}\n${params.message || ""}`.trim(),
        tag: `${event}_${params.demandId || Date.now()}`,
        url,
      });
    }
  } catch (e) {
    // Notificacao nao deve quebrar fluxo do app
    console.warn("[notify] falhou:", e);
  }
}

function shortContext(demand: SlackDemand): string {
  // Pra Infra: prefixa SQL/Deploy + DB se houver
  if (demand.source === "internal") {
    const kind = demand.infraKind === "deploy" ? "Deploy" : "SQL";
    const db = demand.infraDatabase ? ` · ${demand.infraDatabase}` : "";
    return `Infra · ${kind}${db}`;
  }
  // Pra Slack: cliente do canal
  return demand.slackChannel || "Demanda";
}

/** Demanda atribuida a alguem */
export async function notifyAssigned(demand: SlackDemand, assigneeEmail?: string | null): Promise<void> {
  const email = assigneeEmail || emailFromName(demand.assignee?.name);
  if (!email) return;
  await notify({
    userEmail: email,
    event: "demand_assigned",
    source: demand.source === "internal" ? "infra" : "slack",
    demandId: demand.id,
    title: demand.title,
    message: `${shortContext(demand)} · Atribuída a você por ${demand.requester?.name ?? "—"}`,
    actor: demand.requester?.name,
  });
}

/**
 * Coleta emails de destinatarios pra eventos de demanda: requester + assignee.
 * - Resolve emails, deduplica
 * - Por padrao exclui o actor (quem fez a acao) pra evitar auto-notificacao
 * - EXCECAO: assignee == actor (auto-atribuicao) — actor recebe a notificacao
 *   pra ter confirmacao da propria acao
 */
function recipientsForDemand(demand: SlackDemand, actorName?: string): string[] {
  const set = new Set<string>();
  const requesterEmail = emailFromName(demand.requester?.name);
  const assigneeEmail = emailFromName(demand.assignee?.name);
  const actorEmail = emailFromName(actorName);
  const isSelfAssigned = !!assigneeEmail && assigneeEmail === actorEmail;
  if (requesterEmail && requesterEmail !== actorEmail) set.add(requesterEmail);
  if (assigneeEmail && (assigneeEmail !== actorEmail || isSelfAssigned)) set.add(assigneeEmail);
  return [...set];
}

/** Atendimento iniciado (status → em_andamento) */
export async function notifyStarted(demand: SlackDemand, actorName?: string): Promise<void> {
  const actor = actorName || demand.assignee?.name || "—";
  for (const email of recipientsForDemand(demand, actorName)) {
    await notify({
      userEmail: email,
      event: "demand_started",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: demand.title,
      message: `${shortContext(demand)} · ${actor} iniciou o atendimento`,
      actor,
    });
  }
}

/** Demanda concluida */
export async function notifyCompleted(demand: SlackDemand, actorName?: string): Promise<void> {
  const actor = actorName || demand.assignee?.name || "—";
  for (const email of recipientsForDemand(demand, actorName)) {
    await notify({
      userEmail: email,
      event: "demand_completed",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: demand.title,
      message: `${shortContext(demand)} · ${actor} concluiu a demanda ✅`,
      actor,
    });
  }
}

/** Demanda reaberta */
export async function notifyReopened(demand: SlackDemand, actorName?: string): Promise<void> {
  const actor = actorName || "—";
  for (const email of recipientsForDemand(demand, actorName)) {
    await notify({
      userEmail: email,
      event: "demand_reopened",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: demand.title,
      message: `${shortContext(demand)} · ${actor} reabriu a demanda`,
      actor,
    });
  }
}

/** Demanda SQL/Deploy aprovada pelo aprovador.
 * Notifica:
 *   - Solicitante (saber que foi liberada)
 *   - Responsavel (saber que agora pode executar)
 */
export async function notifyApproved(
  demand: SlackDemand,
  approverName?: string,
): Promise<void> {
  const actor = approverName || "—";
  const targets = new Set<string>();
  const requesterEmail = emailFromName(demand.requester?.name);
  const assigneeEmail = emailFromName(demand.assignee?.name);
  if (requesterEmail) targets.add(requesterEmail);
  if (assigneeEmail) targets.add(assigneeEmail);
  for (const email of targets) {
    await notify({
      userEmail: email,
      event: "demand_approved",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: demand.title,
      message: `${shortContext(demand)} · Aprovada por ${actor}`,
      actor,
    });
  }
}

/** Demanda SQL/Deploy reprovada — notifica solicitante */
export async function notifyRejected(
  demand: SlackDemand,
  approverName?: string,
  motivo?: string,
): Promise<void> {
  const requesterEmail = emailFromName(demand.requester?.name);
  if (!requesterEmail) return;
  const actor = approverName || "—";
  const motivoTxt = motivo ? ` — Motivo: ${motivo}` : "";
  await notify({
    userEmail: requesterEmail,
    event: "demand_rejected",
    source: demand.source === "internal" ? "infra" : "slack",
    demandId: demand.id,
    title: demand.title,
    message: `${shortContext(demand)} · Reprovada por ${actor}${motivoTxt}`,
    actor,
  });
}

/** Resposta nova na thread */
export async function notifyReplied(demand: SlackDemand, replyAuthor: string): Promise<void> {
  const assigneeEmail = emailFromName(demand.assignee?.name);
  if (assigneeEmail && demand.assignee?.name !== replyAuthor) {
    await notify({
      userEmail: assigneeEmail,
      event: "demand_replied",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: demand.title,
      message: `${shortContext(demand)} · ${replyAuthor} respondeu`,
      actor: replyAuthor,
    });
  }
}
