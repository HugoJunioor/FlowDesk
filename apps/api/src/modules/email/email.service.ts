/**
 * Email service — envia notificações via SMTP (Gmail/Workspace).
 *
 * Usa nodemailer. Configurado via env: SMTP_HOST/PORT/USER/PASS/FROM/SECURE.
 * Se EMAIL_ENABLED=false, send() vira no-op.
 *
 * Pra Gmail: precisa de App Password (16 chars, 2FA ligado).
 * Pra Workspace: usar SMTP relay (smtp-relay.gmail.com:587).
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.EMAIL_ENABLED) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true=465 (TLS direto), false=STARTTLS (587)
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

interface NotificationEmail {
  to: string;
  titulo: string;
  mensagem: string;
  demandaId?: string;
  ator?: string;
}

function buildHtml(p: NotificationEmail): string {
  const link = p.demandaId
    ? `${env.APP_BASE_URL}/demandas?id=${encodeURIComponent(p.demandaId)}`
    : env.APP_BASE_URL;
  const ator = p.ator ? `<p style="margin:8px 0;color:#64748b;">Por: <strong>${escapeHtml(p.ator)}</strong></p>` : '';
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <div style="font-size:13px;color:#3b82f6;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">FlowDesk</div>
    <h2 style="margin:8px 0 12px;font-size:18px;line-height:1.4;">${escapeHtml(p.titulo)}</h2>
    <p style="margin:0 0 12px;line-height:1.5;color:#334155;">${escapeHtml(p.mensagem)}</p>
    ${ator}
    <a href="${link}" style="display:inline-block;margin-top:16px;padding:10px 16px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Abrir no FlowDesk</a>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">Você pode desativar emails em Configurações → Notificações.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const emailService = {
  async sendNotification(p: NotificationEmail): Promise<void> {
    const t = getTransporter();
    if (!t) return;
    try {
      await t.sendMail({
        from: env.SMTP_FROM,
        to: p.to,
        subject: `[FlowDesk] ${p.titulo}`,
        text: `${p.titulo}\n\n${p.mensagem}\n\n${env.APP_BASE_URL}`,
        html: buildHtml(p),
      });
      logger.info({ to: p.to, titulo: p.titulo }, 'email: notificacao enviada');
    } catch (err) {
      logger.warn({ err, to: p.to }, 'email: falha ao enviar');
    }
  },
};
