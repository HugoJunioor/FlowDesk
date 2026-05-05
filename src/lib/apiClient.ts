/**
 * Cliente HTTP da flowdesk-api.
 *
 * Centraliza chamadas REST. Lê base URL da env VITE_FLOWDESK_API_URL
 * (default: produção Railway). Em modo demo, requests caem em fallback
 * que devolve mock — front continua funcionando sem backend real.
 */
import { isDemoMode } from "@/components/DemoBanner";

/**
 * BASE_URL resolution:
 * - Em DEV (npm run dev): vazio → URL relativa, vai pro Vite dev server
 *   que tem os endpoints /slack/* locais (lendo SLACK_BOT_TOKEN do .env)
 * - Em PROD remoto (Vercel): VITE_FLOWDESK_API_URL aponta pra Railway
 * - Override manual: define VITE_FLOWDESK_API_URL no .env
 *
 * Esquema garante que a maquina do master rode tudo localmente sem
 * depender de Railway (que nao pode ter token Slack real, infra publica).
 */
const isDev = import.meta.env.DEV;
const explicit = import.meta.env.VITE_FLOWDESK_API_URL;
const BASE_URL = explicit
  ? explicit
  : isDev
  ? ""
  : "https://flowdesk-api-production-21cf.up.railway.app";

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
    status: () =>
      request<{ enabled: boolean; team?: string; user?: string; error?: string }>(
        "/slack/status",
        { demoFallback: { enabled: false } }
      ),
  },
};
