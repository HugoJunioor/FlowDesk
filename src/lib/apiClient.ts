/**
 * Cliente HTTP da app.
 *
 * Centraliza chamadas REST pros endpoints /slack/* e /auth/slack/*
 * servidos pelo plugin stateSync (Vite dev e preview). Em modo demo,
 * requests caem em fallback que devolve mock — front continua funcionando
 * sem backend real.
 *
 * BASE_URL: vazio por padrao (URL relativa, mesma origem do front).
 * Override via VITE_FLOWDESK_API_URL pra apontar pra outro servidor.
 */
import { isDemoMode } from "@/components/DemoBanner";

const explicit = import.meta.env.VITE_FLOWDESK_API_URL;
const BASE_URL = explicit || "";

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  /** Quando em demo mode, esse valor mock é retornado em vez de bater na API */
  demoFallback?: unknown;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (isDemoMode && opts.demoFallback !== undefined) {
    // Simula latência leve pra UI mostrar loading state
    await new Promise((r) => setTimeout(r, 300));
    return opts.demoFallback as T;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* ignore */ }
    const msg = (body as { error?: string })?.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }

  return res.json() as Promise<T>;
}

// === Slack ===

export interface SlackReplyRequest {
  permalink?: string;
  channel?: string;
  thread_ts?: string;
  text: string;
  /** Email do user FlowDesk — usado pra postar com identidade real no Slack */
  senderEmail?: string;
}

export interface SlackChannelMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface SlackReplyResponse {
  ok: boolean;
  ts: string;
  channel: string;
  permalink?: string;
}

export interface SlackUploadResponse {
  ok: boolean;
  count: number;
  files: Array<{ ok?: boolean; files?: unknown[] }>;
}

async function uploadMultipart(
  path: string,
  formData: FormData,
  demoFallback?: SlackUploadResponse
): Promise<SlackUploadResponse> {
  if (isDemoMode && demoFallback) {
    await new Promise((r) => setTimeout(r, 800));
    return demoFallback;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* ignore */ }
    const msg = (body as { error?: string })?.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return res.json() as Promise<SlackUploadResponse>;
}

export const apiClient = {
  slack: {
    reply: (body: SlackReplyRequest) =>
      request<SlackReplyResponse>("/slack/reply", {
        method: "POST",
        body: JSON.stringify(body),
        demoFallback: {
          ok: true,
          ts: `${Date.now() / 1000}`,
          channel: body.channel ?? "demo",
          permalink: "https://demo.slack.com/archives/X/p123",
        },
      }),
    upload: (params: { permalink?: string; channel?: string; thread_ts?: string; comment?: string; files: File[] }) => {
      const fd = new FormData();
      if (params.permalink) fd.append("permalink", params.permalink);
      if (params.channel) fd.append("channel", params.channel);
      if (params.thread_ts) fd.append("thread_ts", params.thread_ts);
      if (params.comment) fd.append("comment", params.comment);
      for (const f of params.files) fd.append("file", f);
      return uploadMultipart("/slack/upload", fd, {
        ok: true,
        count: params.files.length,
        files: params.files.map(() => ({ ok: true })),
      });
    },
    editReply: (body: { permalink: string; replyTimestamp: string; newText: string }) =>
      request<{ ok: boolean }>("/slack/edit", {
        method: "POST",
        body: JSON.stringify(body),
        demoFallback: { ok: true },
      }),
    deleteReply: (body: { permalink: string; replyTimestamp: string }) =>
      request<{ ok: boolean }>("/slack/delete", {
        method: "POST",
        body: JSON.stringify(body),
        demoFallback: { ok: true },
      }),
    channelMembers: (channel: string) =>
      request<{ channel: string; members: SlackChannelMember[] }>(
        `/slack/channel-members?channel=${encodeURIComponent(channel)}`,
        { demoFallback: { channel, members: [] } }
      ),
    threadReplies: (permalink: string) =>
      request<{
        replies: Array<{
          ts: string; text: string; userId?: string; timestamp: string;
          author: string; isBot: boolean;
          files: Array<{ id: string; name: string; mimetype: string; size: number; urlPrivate?: string; thumb360?: string; isPublic?: boolean }>;
        }>;
        count: number;
      }>(`/slack/thread-replies?permalink=${encodeURIComponent(permalink)}`,
        { demoFallback: { replies: [], count: 0 } }),
    status: () =>
      request<{ enabled: boolean; team?: string; user?: string; error?: string }>(
        "/slack/status",
        { demoFallback: { enabled: false } }
      ),
  },
  // === Slack User OAuth ===
  // Cada usuario do FlowDesk pode conectar SUA conta Slack pessoal.
  // Quando conectado, mensagens enviadas via composer sao postadas com a
  // identidade real (nao como bot JustFlow).
  auth: {
    /** URL pra iniciar fluxo OAuth — abre Slack pedindo permissao */
    slackStartUrl: (email: string) =>
      `/auth/slack/start?email=${encodeURIComponent(email)}`,
    /** Verifica se user tem token Slack salvo */
    slackStatus: (email: string) =>
      request<{ connected: boolean; slackUserId?: string; teamName?: string; connectedAt?: string }>(
        `/auth/slack/status?email=${encodeURIComponent(email)}`,
        { demoFallback: { connected: false } }
      ),
    /** Remove token (desconecta) */
    slackDisconnect: (email: string) =>
      request<{ ok: boolean }>("/auth/slack/disconnect", {
        method: "POST",
        body: JSON.stringify({ email }),
        demoFallback: { ok: true },
      }),
  },
  // === Demandas internas (modulo Infra) ===
  // Demandas criadas direto no FlowDesk (nao passam por Slack).
  // Persistidas em data/infraDemands.json no servidor.
  infra: {
    /** Lista todas as demandas internas */
    list: () =>
      request<{ demands: import("@/types/demand").SlackDemand[] }>(
        "/infra/demands",
        { demoFallback: { demands: [] } }
      ),
    /** Cria uma nova demanda interna (SQL ou Deploy) */
    create: (body: {
      title: string;
      description?: string;
      priority?: "p1" | "p2" | "p3";
      infraKind: "sql" | "deploy";
      requester?: { name: string; avatar: string };
      assignee?: { name: string; avatar: string };
      dueDate?: string | null;
      client?: string;
      /** Query SQL (so faz sentido pra infraKind=sql) */
      infraQuery?: string;
      /** Banco onde rodar */
      infraDatabase?: string;
      /** Link externo da demanda (ex: ClickUp) */
      infraExternalLink?: string;
      /** Anexos em base64 (max 5MB cada, max 5 arquivos) */
      infraAttachments?: Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        dataUrl: string;
        addedAt: string;
      }>;
    }) =>
      request<{ demand: import("@/types/demand").SlackDemand }>("/infra/demands", {
        method: "POST",
        body: JSON.stringify(body),
        demoFallback: {
          demand: {
            id: `infra_demo_${Date.now()}`,
            title: body.title,
            description: body.description || "",
            priority: body.priority || "p3",
            status: "aberta",
            source: "internal",
            infraKind: body.infraKind,
          } as unknown as import("@/types/demand").SlackDemand,
        },
      }),
    /** Atualiza uma demanda existente (status, assignee, etc) */
    update: (id: string, updates: Partial<import("@/types/demand").SlackDemand>) =>
      request<{ demand: import("@/types/demand").SlackDemand }>(
        `/infra/demands/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
          demoFallback: { demand: {} as import("@/types/demand").SlackDemand },
        }
      ),
    /** Remove uma demanda (admin only) */
    remove: (id: string) =>
      request<{ ok: boolean }>(`/infra/demands/${encodeURIComponent(id)}`, {
        method: "DELETE",
        demoFallback: { ok: true },
      }),
  },
  // === Notifications (inbox de eventos) ===
  notifications: {
    /** Lista notificacoes do user (mais recentes primeiro) */
    list: (email: string) =>
      request<{ notifications: import("@/types/notification").NotificationItem[] }>(
        `/notifications?email=${encodeURIComponent(email)}`,
        { demoFallback: { notifications: [] } }
      ),
    /** Cria notificacao nova (FlowDesk chama internamente em eventos) */
    create: (body: {
      userEmail: string;
      event: import("@/types/notification").NotificationEvent;
      source?: "slack" | "infra";
      demandId: string;
      title?: string;
      message?: string;
      actor?: string;
    }) =>
      request<{ notification: import("@/types/notification").NotificationItem }>("/notifications", {
        method: "POST",
        body: JSON.stringify(body),
        demoFallback: {
          notification: {} as import("@/types/notification").NotificationItem,
        },
      }),
    /** Marca uma notificacao como lida/nao lida */
    markRead: (id: string, read: boolean) =>
      request<{ notification: import("@/types/notification").NotificationItem }>(
        `/notifications/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ read }),
          demoFallback: {
            notification: {} as import("@/types/notification").NotificationItem,
          },
        }
      ),
    /** Marca TODAS as do user como lidas */
    markAllRead: (email: string) =>
      request<{ ok: boolean; count: number }>(
        `/notifications/mark-all-read?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          demoFallback: { ok: true, count: 0 },
        }
      ),
    /** Pega preferencias do user */
    getPreferences: (email: string) =>
      request<{ preferences: import("@/types/notification").NotificationPreferences | null }>(
        `/notifications/preferences?email=${encodeURIComponent(email)}`,
        { demoFallback: { preferences: null } }
      ),
    /** Atualiza preferencias do user */
    savePreferences: (prefs: import("@/types/notification").NotificationPreferences) =>
      request<{ preferences: import("@/types/notification").NotificationPreferences }>(
        "/notifications/preferences",
        {
          method: "PUT",
          body: JSON.stringify(prefs),
          demoFallback: { preferences: prefs },
        }
      ),
  },

  // Bloco de notas pessoal
  notes: {
    list: (email: string) =>
      request<{ notes: import("@/types/note").Note[] }>(
        `/notes?email=${encodeURIComponent(email)}`,
        { demoFallback: { notes: [] } }
      ),
    create: (body: {
      userEmail: string;
      title: string;
      content?: string;
      status?: import("@/types/note").NoteStatus;
      tags?: string[];
      color?: string | null;
    }) =>
      request<{ note: import("@/types/note").Note }>("/notes", {
        method: "POST",
        body: JSON.stringify(body),
        demoFallback: { note: {} as import("@/types/note").Note },
      }),
    update: (
      id: string,
      updates: Partial<Pick<import("@/types/note").Note, "title" | "content" | "status" | "tags" | "color" | "order">>,
    ) =>
      request<{ note: import("@/types/note").Note }>(
        `/notes/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
          demoFallback: { note: {} as import("@/types/note").Note },
        }
      ),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/notes/${encodeURIComponent(id)}`, {
        method: "DELETE",
        demoFallback: { ok: true },
      }),
  },
};
