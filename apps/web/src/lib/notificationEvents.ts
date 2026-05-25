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

/** Atendimento iniciado (status → em_andamento) */
export async function notifyStarted(demand: SlackDemand, actorName?: string): Promise<void> {
  const requesterEmail = emailFromName(demand.requester?.name);
  if (requesterEmail) {
    const actor = actorName || demand.assignee?.name || "—";
    await notify({
      userEmail: requesterEmail,
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
  const requesterEmail = emailFromName(demand.requester?.name);
  if (requesterEmail) {
    const actor = actorName || demand.assignee?.name || "—";
    await notify({
      userEmail: requesterEmail,
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
  const assigneeEmail = emailFromName(demand.assignee?.name);
  if (assigneeEmail) {
    const actor = actorName || "—";
    await notify({
      userEmail: assigneeEmail,
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
