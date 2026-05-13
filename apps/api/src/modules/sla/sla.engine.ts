/**
 * Engine de SLA reminders server-side.
 *
 * Substitui (ou complementa) o engine do frontend que só dispara
 * quando o usuário tem aba aberta. Esta versão roda no servidor a
 * cada N segundos, varre demandas abertas e dispara notificações
 * direto na inbox (tb_notificacao) — usuário recebe ao abrir.
 *
 * Anti-spam: usa as próprias notificações como guard.
 *   - Antes de criar `demand_due_soon`, verifica se já existe uma
 *     pra mesma demanda+user nas últimas 24h
 *   - Antes de criar `demand_overdue`, verifica se já existe
 *
 * Respeita preferências do usuário (tb_preferencia_notificacao).
 */
import { pool } from '@config/database';
import { logger } from '@shared/logging/logger';
import { getBusinessMinutesBetween } from '@shared/business-hours/business-hours';

interface DemandaRow {
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
  origem: string;
  due_date: Date;
  responsavel_nome: string | null;
  solicitante_nome: string | null;
}

interface PrefRow {
  usuario_email: string;
  eventos: Record<string, boolean>;
  sla_reminders: { p1Hours: number; p2Hours: number; p3Hours: number };
}

interface UserRow {
  email: string;
  nome: string;
}

function hoursThresholdFor(priority: string, prefs: PrefRow['sla_reminders']): number {
  if (priority === 'p1') return prefs.p1Hours;
  if (priority === 'p2') return prefs.p2Hours;
  if (priority === 'p3') return prefs.p3Hours;
  return 0;
}

async function alreadyNotified(
  usuarioEmail: string,
  demandaId: string,
  evento: 'demand_due_soon' | 'demand_overdue',
  withinHours = 24,
): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM tb_notificacao
       WHERE usuario_email = $1
         AND demanda_id = $2
         AND evento = $3
         AND criado_em > NOW() - ($4 || ' hours')::interval
     ) AS exists`,
    [usuarioEmail, demandaId, evento, withinHours.toString()],
  );
  return Boolean(res.rows[0]?.exists);
}

async function createNotificacao(args: {
  usuarioEmail: string;
  evento: 'demand_due_soon' | 'demand_overdue';
  demandaId: string;
  origem: string;
  titulo: string;
  mensagem: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO tb_notificacao
       (usuario_email, evento, origem, demanda_id, titulo, mensagem)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      args.usuarioEmail,
      args.evento,
      args.origem === 'internal' ? 'infra' : args.origem,
      args.demandaId,
      args.titulo,
      args.mensagem,
    ],
  );
}

function formatTimeLeft(mins: number): string {
  if (mins <= 0) return 'menos de 1min';
  if (mins < 60) return `${Math.round(mins)}min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Executa uma rodada. Idempotente: pode ser chamada várias vezes que
 * o anti-spam garante não duplicar.
 */
export async function runSlaReminderCycle(): Promise<{
  varridas: number;
  dueSoonCriadas: number;
  overdueCriadas: number;
}> {
  const start = Date.now();

  // 1. Carrega demandas abertas com dueDate definido
  const demandasRes = await pool.query<DemandaRow>(
    `SELECT id, titulo, prioridade, status, origem, due_date,
            responsavel_nome, solicitante_nome
     FROM tb_demanda
     WHERE excluido_em IS NULL
       AND status NOT IN ('concluida', 'expirada')
       AND prioridade IN ('p1', 'p2', 'p3')
       AND due_date IS NOT NULL`,
  );

  // 2. Carrega usuários ativos (mapa nome -> email)
  const usersRes = await pool.query<UserRow>(
    `SELECT email, nome FROM tb_usuario
     WHERE excluido_em IS NULL AND status = 'active'`,
  );
  const nameToEmail = new Map<string, string>();
  for (const u of usersRes.rows) {
    nameToEmail.set(u.nome.toLowerCase(), u.email);
  }

  // 3. Carrega preferências de todos os users
  const prefsRes = await pool.query<PrefRow>(
    `SELECT usuario_email, eventos, sla_reminders FROM tb_preferencia_notificacao`,
  );
  const prefsByEmail = new Map<string, PrefRow>();
  for (const p of prefsRes.rows) {
    prefsByEmail.set(p.usuario_email.toLowerCase(), p);
  }

  let dueSoonCriadas = 0;
  let overdueCriadas = 0;
  const now = new Date();

  for (const d of demandasRes.rows) {
    // Quem é "interessado": responsavel + solicitante (se forem da equipe)
    const interessados = new Set<string>();
    if (d.responsavel_nome) {
      const email = nameToEmail.get(d.responsavel_nome.toLowerCase());
      if (email) interessados.add(email);
    }
    if (d.solicitante_nome) {
      const email = nameToEmail.get(d.solicitante_nome.toLowerCase());
      if (email) interessados.add(email);
    }
    if (interessados.size === 0) continue;

    const minsToDue = getBusinessMinutesBetween(now, d.due_date);
    const isOverdue = minsToDue < 0;

    for (const email of interessados) {
      const prefs = prefsByEmail.get(email.toLowerCase());
      const eventos = prefs?.eventos ?? {};
      const slaRem = prefs?.sla_reminders ?? { p1Hours: 1, p2Hours: 2, p3Hours: 4 };

      if (isOverdue) {
        if (eventos.demand_overdue === false) continue;
        if (await alreadyNotified(email, d.id, 'demand_overdue')) continue;
        await createNotificacao({
          usuarioEmail: email,
          evento: 'demand_overdue',
          demandaId: d.id,
          origem: d.origem,
          titulo: d.titulo,
          mensagem: `SLA estourado · prazo era ${d.due_date.toLocaleString('pt-BR')}`,
        });
        overdueCriadas++;
      } else {
        if (eventos.demand_due_soon === false) continue;
        const hoursBefore = hoursThresholdFor(d.prioridade, slaRem);
        if (hoursBefore <= 0) continue;
        const thresholdMins = hoursBefore * 60;
        if (minsToDue > thresholdMins) continue;
        if (await alreadyNotified(email, d.id, 'demand_due_soon')) continue;
        await createNotificacao({
          usuarioEmail: email,
          evento: 'demand_due_soon',
          demandaId: d.id,
          origem: d.origem,
          titulo: d.titulo,
          mensagem: `Vence em ${formatTimeLeft(minsToDue)} (prazo: ${d.due_date.toLocaleString('pt-BR')})`,
        });
        dueSoonCriadas++;
      }
    }
  }

  logger.info(
    {
      varridas: demandasRes.rows.length,
      dueSoonCriadas,
      overdueCriadas,
      durationMs: Date.now() - start,
    },
    'sla cycle done',
  );

  return {
    varridas: demandasRes.rows.length,
    dueSoonCriadas,
    overdueCriadas,
  };
}
