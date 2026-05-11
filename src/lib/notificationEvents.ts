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
} from "@/types/notification";
import { SlackDemand } from "@/types/demand";
import { getAllUsers } from "./authStorage";

/**
 * Resolve email do assignee/requester a partir do nome.
 * Tenta primeiro lookup em FlowDesk users (login/email), senao retorna null.
 */
function emailFromName(name: string | undefined): string | null {
  if (!name) return null;
  try {
    const users = getAllUsers();
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
    // Inbox sempre ligado (canal core)
    if (!prefs.channels.inbox) return;
    // Evento desabilitado pelo user? pula
    if (prefs.events[event] === false) return;
    await apiClient.notifications.create(params);
  } catch (e) {
    // Notificacao nao deve quebrar fluxo do app
    console.warn("[notify] falhou:", e);
  }
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
    title: "Demanda atribuída a você",
    message: demand.title,
    actor: demand.requester?.name,
  });
}

/** Atendimento iniciado (status → em_andamento) */
export async function notifyStarted(demand: SlackDemand, actorName?: string): Promise<void> {
  // Notifica solicitante (quem abriu)
  const requesterEmail = emailFromName(demand.requester?.name);
  if (requesterEmail) {
    await notify({
      userEmail: requesterEmail,
      event: "demand_started",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: "Atendimento iniciado",
      message: demand.title,
      actor: actorName || demand.assignee?.name,
    });
  }
}

/** Demanda concluida */
export async function notifyCompleted(demand: SlackDemand, actorName?: string): Promise<void> {
  const requesterEmail = emailFromName(demand.requester?.name);
  if (requesterEmail) {
    await notify({
      userEmail: requesterEmail,
      event: "demand_completed",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: "Demanda concluída ✅",
      message: demand.title,
      actor: actorName || demand.assignee?.name,
    });
  }
}

/** Demanda reaberta */
export async function notifyReopened(demand: SlackDemand, actorName?: string): Promise<void> {
  const assigneeEmail = emailFromName(demand.assignee?.name);
  if (assigneeEmail) {
    await notify({
      userEmail: assigneeEmail,
      event: "demand_reopened",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: "Demanda reaberta",
      message: demand.title,
      actor: actorName,
    });
  }
}

/** Resposta nova na thread */
export async function notifyReplied(demand: SlackDemand, replyAuthor: string): Promise<void> {
  // Notifica assignee se nao foi quem respondeu
  const assigneeEmail = emailFromName(demand.assignee?.name);
  if (assigneeEmail && demand.assignee?.name !== replyAuthor) {
    await notify({
      userEmail: assigneeEmail,
      event: "demand_replied",
      source: demand.source === "internal" ? "infra" : "slack",
      demandId: demand.id,
      title: "Nova resposta",
      message: demand.title,
      actor: replyAuthor,
    });
  }
}
