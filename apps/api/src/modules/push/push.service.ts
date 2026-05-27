/**
 * Web Push via VAPID — registra subscriptions e dispara push messages.
 *
 * Frontend chama POST /push/subscribe ao habilitar canal de push.
 * Quando uma notificacao eh criada e canais.browserPush=true, o
 * notificacao.service chama pushService.sendToUser pra cada subscription
 * registrada daquele user.
 *
 * Sem VAPID_PUBLIC_KEY/PRIVATE_KEY configurado, send() vira no-op.
 */
import webpush from 'web-push';
import { env } from '@config/env';
import { pool } from '@config/database';
import { logger } from '@shared/logging/logger';

let configured = false;
function configure(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const pushService = {
  /** Retorna a chave pública VAPID pro frontend usar no subscribe(). */
  getPublicKey(): string {
    return env.VAPID_PUBLIC_KEY;
  },

  /** Salva (ou atualiza) uma subscription pra um usuário. */
  async subscribe(userEmail: string, sub: SubscriptionInput, userAgent?: string): Promise<void> {
    await pool.query(
      `INSERT INTO tb_push_subscription (usuario_email, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
         SET p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             usuario_email = EXCLUDED.usuario_email,
             user_agent = EXCLUDED.user_agent,
             atualizado_em = NOW()`,
      [userEmail, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent ?? null],
    );
  },

  /** Remove uma subscription pelo endpoint. */
  async unsubscribe(endpoint: string): Promise<void> {
    await pool.query(`DELETE FROM tb_push_subscription WHERE endpoint = $1`, [endpoint]);
  },

  /**
   * Envia uma push notification pra todas subscriptions registradas do user.
   * Fire-and-forget. Remove subscriptions que falham com 404/410 (expiradas).
   */
  async sendToUser(
    userEmail: string,
    payload: { title: string; body: string; url?: string; tag?: string },
  ): Promise<void> {
    if (!configure()) return;
    const res = await pool.query<{
      endpoint: string; p256dh: string; auth: string;
    }>(
      `SELECT endpoint, p256dh, auth FROM tb_push_subscription WHERE usuario_email = $1`,
      [userEmail],
    );
    if (res.rows.length === 0) return;
    const body = JSON.stringify(payload);
    await Promise.all(
      res.rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            body,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expirada — limpa do banco
            await pool.query(`DELETE FROM tb_push_subscription WHERE endpoint = $1`, [row.endpoint])
              .catch(() => { /* ignore */ });
            logger.info({ endpoint: row.endpoint }, 'push: subscription expirada removida');
          } else {
            logger.warn({ err, endpoint: row.endpoint }, 'push: falha ao enviar');
          }
        }
      }),
    );
  },
};
