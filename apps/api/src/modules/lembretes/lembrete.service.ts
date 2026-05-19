/**
 * Service do lembrete diário.
 *
 * Para cada usuário ativo com daily_reminder=true:
 *   - Busca demandas onde ele é responsavel/solicitante e status não é concluida/expirada
 *   - Se >= 1, envia e-mail com resumo
 *
 * Modo dry-run: se SMTP não estiver configurado, loga sem enviar.
 */
import nodemailer from 'nodemailer';
import { pool } from '@config/database';
import { env } from '@config/env';
import { logger } from '@shared/logging/logger';
import { getBusinessMinutesBetween } from '@shared/business-hours/business-hours';
import {
  buildEmailHtml,
  buildEmailText,
  type DemandaResumo,
  type SlaStatus,
} from './lembrete.template';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface UsuarioRow {
  id: string;
  email: string;
  nome: string;
}

interface DemandaRow {
  id: string;
  titulo: string;
  prioridade: string;
  due_date: Date | null;
}

// ---------------------------------------------------------------------------
// Transporter (lazy singleton)
// ---------------------------------------------------------------------------

let _transporter: nodemailer.Transporter | null = null;

function isDryRun(): boolean {
  return !env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS;
}

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return _transporter;
}

// ---------------------------------------------------------------------------
// SLA helpers
// ---------------------------------------------------------------------------

function calcSla(dueDate: Date | null, now: Date): { status: SlaStatus; label: string } {
  if (!dueDate) return { status: 'sem_prazo', label: 'Sem prazo definido' };

  const mins = getBusinessMinutesBetween(now, dueDate);

  if (mins < 0) {
    const elapsed = Math.abs(mins);
    const label = elapsed < 60
      ? `estourado há ${Math.round(elapsed)}min`
      : `estourado há ${Math.round(elapsed / 60)}h`;
    return { status: 'estourado', label };
  }

  if (mins <= 240) {
    // <= 4h — "próximo"
    const label = mins < 60
      ? `${Math.round(mins)}min restantes`
      : `${Math.round(mins / 60)}h restantes`;
    return { status: 'proximo', label };
  }

  const label = mins < 60
    ? `${Math.round(mins)}min restantes`
    : `${Math.round(mins / 60)}h restantes`;
  return { status: 'no_prazo', label };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function fetchActiveUsers(): Promise<UsuarioRow[]> {
  const res = await pool.query<UsuarioRow>(
    `SELECT u.id, u.email, u.nome
     FROM tb_usuario u
     LEFT JOIN tb_preferencia_notificacao p ON p.usuario_email = u.email
     WHERE u.excluido_em IS NULL
       AND u.status = 'active'
       AND COALESCE(p.daily_reminder, true) = true`,
  );
  return res.rows;
}

async function fetchDemandasAbertas(nomeUsuario: string): Promise<DemandaRow[]> {
  // Demandas onde o usuário é responsável ou solicitante, ainda abertas
  const res = await pool.query<DemandaRow>(
    `SELECT id, titulo, prioridade, due_date
     FROM tb_demanda
     WHERE excluido_em IS NULL
       AND status NOT IN ('concluida', 'expirada')
       AND (
         LOWER(responsavel_nome) = LOWER($1)
         OR LOWER(solicitante_nome) = LOWER($1)
       )
     ORDER BY
       CASE prioridade WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 WHEN 'p3' THEN 3 ELSE 4 END,
       due_date ASC NULLS LAST`,
    [nomeUsuario],
  );
  return res.rows;
}

// ---------------------------------------------------------------------------
// Envio de e-mail
// ---------------------------------------------------------------------------

async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (isDryRun()) {
    logger.info(
      { to: args.to, subject: args.subject },
      'lembrete dry-run — SMTP nao configurado, email nao enviado',
    );
    return;
  }

  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
}

// ---------------------------------------------------------------------------
// Ciclo principal
// ---------------------------------------------------------------------------

export interface LembreteCycleResult {
  usuariosProcessados: number;
  emailsEnviados: number;
  emailsIgnorados: number;
}

export async function runLembreteDiarioCycle(): Promise<LembreteCycleResult> {
  const start = Date.now();
  const now = new Date();

  const usuarios = await fetchActiveUsers();
  let emailsEnviados = 0;
  let emailsIgnorados = 0;

  for (const usuario of usuarios) {
    try {
      const demandasRows = await fetchDemandasAbertas(usuario.nome);

      if (demandasRows.length === 0) {
        emailsIgnorados++;
        continue;
      }

      const demandas: DemandaResumo[] = demandasRows.map((d) => {
        const { status, label } = calcSla(d.due_date, now);
        return {
          id: d.id,
          titulo: d.titulo,
          prioridade: d.prioridade,
          slaStatus: status,
          slaLabel: label,
        };
      });

      const html = buildEmailHtml({
        nomeUsuario: usuario.nome,
        demandas,
        baseUrl: env.APP_BASE_URL,
      });
      const text = buildEmailText({
        nomeUsuario: usuario.nome,
        demandas,
        baseUrl: env.APP_BASE_URL,
      });

      await sendEmail({
        to: usuario.email,
        subject: `FlowDesk — ${demandas.length} demanda${demandas.length !== 1 ? 's' : ''} em aberto`,
        html,
        text,
      });

      emailsEnviados++;
    } catch (err) {
      logger.error({ err, usuarioEmail: usuario.email }, 'falha ao processar lembrete para usuario');
    }
  }

  logger.info(
    {
      usuariosProcessados: usuarios.length,
      emailsEnviados,
      emailsIgnorados,
      durationMs: Date.now() - start,
    },
    'lembrete diario cycle done',
  );

  return {
    usuariosProcessados: usuarios.length,
    emailsEnviados,
    emailsIgnorados,
  };
}
