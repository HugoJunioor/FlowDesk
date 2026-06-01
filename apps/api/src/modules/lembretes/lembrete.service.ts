/**
 * Service do lembrete diário.
 *
 * Para cada usuário ativo com daily_reminder=true:
 *   - Busca demandas onde ele é o RESPONSÁVEL e status não é concluida/expirada
 *   - Se >= 1, envia e-mail com resumo
 *
 * Importante: filtra SO por responsavel_nome (nao solicitante). Demandas que
 * voce CRIOU mas nao precisa atuar nao entram no resumo — caso contrario
 * voce recebe inbox enorme com tudo que pediu pra outra pessoa fazer.
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
  permalink_slack: string | null;
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

interface SlaCalc {
  status: SlaStatus;
  label: string;
  /** Minutos uteis ate o prazo (negativo = estourado). null se sem prazo. */
  minutes: number | null;
}

function calcSla(dueDate: Date | null, now: Date): SlaCalc {
  if (!dueDate) return { status: 'sem_prazo', label: '—', minutes: null };

  const mins = getBusinessMinutesBetween(now, dueDate);

  if (mins < 0) {
    const elapsed = Math.abs(mins);
    const label = elapsed < 60
      ? `estourado há ${Math.round(elapsed)}min`
      : `estourado há ${Math.round(elapsed / 60)}h`;
    return { status: 'estourado', label, minutes: mins };
  }

  if (mins <= 240) {
    // <= 4h — "próximo"
    const label = mins < 60
      ? `${Math.round(mins)}min restantes`
      : `${Math.round(mins / 60)}h restantes`;
    return { status: 'proximo', label, minutes: mins };
  }

  const label = mins < 60
    ? `${Math.round(mins)}min restantes`
    : `${Math.round(mins / 60)}h restantes`;
  return { status: 'no_prazo', label, minutes: mins };
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
  // Demandas onde o usuario eh o RESPONSAVEL (precisa atuar), ainda abertas.
  // NAO filtra por solicitante — voce nao quer ser lembrado de demandas que
  // VOCE pediu pra outra pessoa fazer; quem precisa do lembrete eh o
  // responsavel.
  const res = await pool.query<DemandaRow>(
    `SELECT id, titulo, prioridade, due_date, permalink_slack
     FROM tb_demanda
     WHERE excluido_em IS NULL
       AND status NOT IN ('concluida', 'expirada')
       AND LOWER(responsavel_nome) = LOWER($1)`,
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

      // Calcula SLA pra cada demanda. Mantemos minutes separado para sort.
      const enriched = demandasRows.map((d) => {
        const sla = calcSla(d.due_date, now);
        return { row: d, sla };
      });

      // Sort: estouradas primeiro (mais antigas = minutes mais negativo),
      // depois por minutos restantes ASC (mais critico antes). Sem-prazo no fim.
      enriched.sort((a, b) => {
        const am = a.sla.minutes;
        const bm = b.sla.minutes;
        if (am === null && bm === null) return 0;
        if (am === null) return 1;
        if (bm === null) return -1;
        return am - bm;
      });

      const demandas: DemandaResumo[] = enriched.map(({ row, sla }) => ({
        id: row.id,
        titulo: row.titulo,
        prioridade: row.prioridade,
        slaStatus: sla.status,
        slaLabel: sla.label,
        permalinkSlack: row.permalink_slack,
      }));

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
        subject: `Just Flow — ${demandas.length} demanda${demandas.length !== 1 ? 's' : ''} em aberto`,
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
