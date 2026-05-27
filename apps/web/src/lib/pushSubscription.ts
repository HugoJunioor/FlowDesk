/**
 * Helpers de Web Push (Service Worker + PushManager).
 *
 * Fluxo:
 *   1. registerServiceWorker() - registra /sw.js
 *   2. subscribePush() - cria PushSubscription com VAPID public key + envia pro server
 *   3. unsubscribePush() - cancela subscription local e remove no server
 *
 * Backend: /api/v1/push/{public-key,subscribe,unsubscribe}.
 */
import { apiClient } from "@/lib/api/client";

const SW_URL = "/sw.js";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await apiClient.get<{ sucesso: boolean; dados: { publicKey: string } }>(
      "/push/public-key",
    );
    return res.data?.dados?.publicKey || null;
  } catch {
    return null;
  }
}

/** Garante uma subscription ativa pro user logado e envia pro server. */
export async function subscribePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;
  await navigator.serviceWorker.ready;

  const publicKey = await fetchPublicKey();
  if (!publicKey) {
    console.warn("[push] VAPID public key nao disponivel — push desligado no server");
    return false;
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await apiClient.post("/push/subscribe", {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  });
  return true;
}

/** Remove a subscription local e no server. */
export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => { /* ignore */ });
  await apiClient.post("/push/unsubscribe", { endpoint }).catch(() => { /* ignore */ });
}
