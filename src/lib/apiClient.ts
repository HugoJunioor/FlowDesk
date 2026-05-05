/**
 * Cliente HTTP da flowdesk-api.
 *
 * Centraliza chamadas REST. Lê base URL da env VITE_FLOWDESK_API_URL
 * (default: produção Railway). Em modo demo, requests caem em fallback
 * que devolve mock — front continua funcionando sem backend real.
 */
import { isDemoMode } from "@/components/DemoBanner";

const BASE_URL =
  import.meta.env.VITE_FLOWDESK_API_URL ??
  "https://flowdesk-api-production-21cf.up.railway.app";

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
    status: () =>
      request<{ enabled: boolean; team?: string; user?: string; error?: string }>(
        "/slack/status",
        { demoFallback: { enabled: false } }
      ),
  },
};
