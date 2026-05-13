/**
 * Script de migração: JSON files (legado Vite plugin) → Postgres.
 *
 * Lê os arquivos gerados pelo `scripts/stateSync.mjs` em `apps/web/data/`
 * e popula as tabelas correspondentes no Postgres. Idempotente: pula
 * registros que já existem (por id).
 *
 * Uso:
 *   # Dry run (não escreve nada, só conta o que faria):
 *   npm run import:json -- --dry-run
 *
 *   # Importa tudo:
 *   npm run import:json
 *
 *   # Importa só uma fonte:
 *   npm run import:json -- --only=notas
 *   npm run import:json -- --only=notificacoes
 *   npm run import:json -- --only=infra
 *
 * Variáveis:
 *   DATABASE_URL              (obrigatório)
 *   IMPORT_SOURCE_DIR         (default: ../web/data relativo a apps/api)
 *
 * Pode ser executado com a aplicação NO AR — todos os INSERTs usam
 * ON CONFLICT DO NOTHING.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../config/database';
import { logger } from '../shared/logging/logger';

// Resolve a partir do cwd (esperado: rodar de apps/api). Se cwd for
// diferente, define IMPORT_SOURCE_DIR explicitamente.
const SOURCE_DIR = process.env.IMPORT_SOURCE_DIR ||
  path.resolve(process.cwd(), '..', 'web', 'data');

interface CliFlags {
  dryRun: boolean;
  only: 'notas' | 'notificacoes' | 'preferencias' | 'infra' | 'tudo';
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { dryRun: false, only: 'tudo' };
  for (const a of argv) {
    if (a === '--dry-run') flags.dryRun = true;
    if (a.startsWith('--only=')) {
      const v = a.slice('--only='.length) as CliFlags['only'];
      flags.only = v;
    }
  }
  return flags;
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    logger.warn({ filePath }, 'arquivo nao existe, pulando');
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (err) {
    logger.error({ filePath, err }, 'falha ao parsear JSON');
    return fallback;
  }
}

// ============= Notas =============

interface JsonNote {
  id: string;
  userEmail: string;
  title: string;
  content: string;
  status: 'todo' | 'doing' | 'done';
  tags: string[];
  color: string | null;
  items?: Array<{ id: string; text: string; done: boolean }>;
  order: number;
  createdAt: string;
  updatedAt: string;
}

async function importNotas(dryRun: boolean): Promise<{ inserted: number; skipped: number }> {
  const file = path.join(SOURCE_DIR, 'notes.json');
  const notas = readJsonSafe<JsonNote[]>(file, []);
  let inserted = 0;
  let skipped = 0;
  for (const n of notas) {
    if (dryRun) { inserted++; continue; }
    const res = await pool.query(
      `INSERT INTO tb_nota
         (id, usuario_email, titulo, conteudo, status, tags, cor, ordem, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        n.id,
        n.userEmail,
        n.title,
        n.content ?? '',
        n.status,
        n.tags ?? [],
        n.color,
        n.order,
        n.createdAt,
        n.updatedAt,
      ],
    );
    if ((res.rowCount ?? 0) > 0) {
      inserted++;
      // Items
      let ordem = 0;
      for (const item of n.items ?? []) {
        await pool.query(
          `INSERT INTO tb_item_nota (id, nota_id, texto, feito, ordem)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [item.id, n.id, item.text, item.done, ordem++],
        );
      }
    } else {
      skipped++;
    }
  }
  return { inserted, skipped };
}

// ============= Notificações =============

interface JsonNotification {
  id: string;
  userEmail: string;
  event: string;
  source: 'slack' | 'infra';
  demandId: string;
  title: string;
  message: string;
  actor?: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
  sentVia?: string[];
}

async function importNotificacoes(
  dryRun: boolean,
): Promise<{ inserted: number; skipped: number }> {
  const file = path.join(SOURCE_DIR, 'notifications.json');
  const items = readJsonSafe<JsonNotification[]>(file, []);
  let inserted = 0;
  let skipped = 0;
  for (const n of items) {
    if (dryRun) { inserted++; continue; }
    // demandId no JSON pode não ser UUID válido (slack ids); só persiste se for
    const demandaId = /^[0-9a-f-]{36}$/i.test(n.demandId) ? n.demandId : null;
    const res = await pool.query(
      `INSERT INTO tb_notificacao
         (id, usuario_email, evento, origem, demanda_id, titulo, mensagem,
          ator, lida, lida_em, enviada_por, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [
        n.id,
        n.userEmail,
        n.event,
        n.source,
        demandaId,
        n.title,
        n.message ?? '',
        n.actor ?? null,
        n.read,
        n.readAt ?? null,
        n.sentVia ?? null,
        n.createdAt,
      ],
    );
    if ((res.rowCount ?? 0) > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

// ============= Preferências de notificação =============

interface JsonPrefs {
  [email: string]: {
    userEmail: string;
    events: Record<string, boolean>;
    channels: { inbox: boolean; browserPush: boolean; email: boolean };
    slaReminders: { p1Hours: number; p2Hours: number; p3Hours: number };
  };
}

async function importPreferencias(
  dryRun: boolean,
): Promise<{ inserted: number; skipped: number }> {
  const file = path.join(SOURCE_DIR, 'notificationPreferences.json');
  const prefs = readJsonSafe<JsonPrefs>(file, {});
  let inserted = 0;
  for (const email of Object.keys(prefs)) {
    const p = prefs[email];
    if (!p) continue;
    if (dryRun) { inserted++; continue; }
    await pool.query(
      `INSERT INTO tb_preferencia_notificacao
         (usuario_email, eventos, canais, sla_reminders, atualizado_em)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (usuario_email) DO UPDATE
         SET eventos = EXCLUDED.eventos,
             canais = EXCLUDED.canais,
             sla_reminders = EXCLUDED.sla_reminders,
             atualizado_em = NOW()`,
      [
        email,
        JSON.stringify(p.events),
        JSON.stringify(p.channels),
        JSON.stringify(p.slaReminders),
      ],
    );
    inserted++;
  }
  return { inserted, skipped: 0 };
}

// ============= Demandas Infra =============

interface JsonInfraDemand {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  source?: string;
  infraKind?: 'sql' | 'deploy';
  infraQuery?: string;
  infraDatabase?: string;
  infraExternalLink?: string;
  requester: { name: string; avatar?: string };
  assignee?: { name: string; avatar?: string } | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  tags?: string[];
  hasTask?: boolean;
  taskLink?: string;
}

async function importInfraDemandas(
  dryRun: boolean,
): Promise<{ inserted: number; skipped: number }> {
  const file = path.join(SOURCE_DIR, 'infraDemands.json');
  const items = readJsonSafe<JsonInfraDemand[]>(file, []);
  let inserted = 0;
  let skipped = 0;
  for (const d of items) {
    if (dryRun) { inserted++; continue; }
    const res = await pool.query(
      `INSERT INTO tb_demanda
         (id, titulo, descricao, prioridade, status, origem,
          solicitante_nome, solicitante_avatar,
          responsavel_nome, responsavel_avatar,
          infra_kind, infra_query, infra_database, infra_external_link,
          due_date, concluida_em, has_task, task_link, tags, criado_em)
       VALUES ($1, $2, $3, $4, $5, 'internal',
               $6, $7, $8, $9,
               $10, $11, $12, $13,
               $14, $15, $16, $17, $18, $19)
       ON CONFLICT (id) DO NOTHING`,
      [
        d.id,
        d.title,
        d.description ?? null,
        d.priority,
        d.status,
        d.requester?.name ?? null,
        d.requester?.avatar ?? null,
        d.assignee?.name ?? null,
        d.assignee?.avatar ?? null,
        d.infraKind ?? null,
        d.infraQuery ?? null,
        d.infraDatabase ?? null,
        d.infraExternalLink ?? null,
        d.dueDate ?? null,
        d.completedAt ?? null,
        d.hasTask ?? false,
        d.taskLink ?? null,
        d.tags ?? [],
        d.createdAt,
      ],
    );
    if ((res.rowCount ?? 0) > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

// ============= Main =============

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  logger.info({ flags, sourceDir: SOURCE_DIR }, 'iniciando import');

  if (!fs.existsSync(SOURCE_DIR)) {
    logger.error({ SOURCE_DIR }, 'diretorio fonte nao existe');
    process.exit(1);
  }

  const ran: Record<string, { inserted: number; skipped: number }> = {};

  if (flags.only === 'tudo' || flags.only === 'notas') {
    ran.notas = await importNotas(flags.dryRun);
    logger.info(ran.notas, 'notas importadas');
  }
  if (flags.only === 'tudo' || flags.only === 'notificacoes') {
    ran.notificacoes = await importNotificacoes(flags.dryRun);
    logger.info(ran.notificacoes, 'notificacoes importadas');
  }
  if (flags.only === 'tudo' || flags.only === 'preferencias') {
    ran.preferencias = await importPreferencias(flags.dryRun);
    logger.info(ran.preferencias, 'preferencias importadas');
  }
  if (flags.only === 'tudo' || flags.only === 'infra') {
    ran.infra = await importInfraDemandas(flags.dryRun);
    logger.info(ran.infra, 'demandas infra importadas');
  }

  /* eslint-disable no-console */
  console.log('\n========================================');
  console.log(flags.dryRun ? 'DRY RUN — nada foi escrito no banco' : 'IMPORT CONCLUIDO');
  console.log('========================================');
  for (const [k, v] of Object.entries(ran)) {
    console.log(`  ${k}: inserted=${v.inserted}, skipped=${v.skipped}`);
  }
  console.log('========================================\n');

  await pool.end();
}

void main().catch((err) => {
  logger.error({ err }, 'import falhou');
  process.exit(1);
});
