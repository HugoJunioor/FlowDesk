/**
 * scripts/preflight-check.mjs
 *
 * Valida o ambiente ANTES de subir os containers Docker.
 * Verifica vars obrigatórias, conectividade com Postgres, Slack e Telegram.
 *
 * Uso: node scripts/preflight-check.mjs
 * Exit 0 = tudo ok. Exit 1 = falha(s) detectada(s).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const OK = `${GREEN}✓${RESET}`;
const FAIL = `${RED}✗${RESET}`;
const WARN = `${YELLOW}~${RESET}`;

function header(title) {
  console.log(`\n${BOLD}${title}${RESET}`);
}

function pass(msg) {
  console.log(`  ${OK} ${msg}`);
}

function fail(msg) {
  console.log(`  ${FAIL} ${msg}`);
}

function warn(msg) {
  console.log(`  ${WARN} ${msg}`);
}

/** Lê e processa um arquivo .env, retornando um objeto key=value. */
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) result[key] = val;
  }
  return result;
}

/** Retorna o valor de uma env var: primeiro do process.env, depois dos .env lidos. */
function getEnv(key, loaded) {
  return process.env[key] ?? loaded[key] ?? '';
}

// ---------------------------------------------------------------------------
// Carregar .env
// ---------------------------------------------------------------------------

const rootEnv = parseEnvFile(join(ROOT, '.env'));
const apiEnv = parseEnvFile(join(ROOT, 'apps', 'api', '.env'));
const loaded = { ...rootEnv, ...apiEnv };

// Expor no process.env para libs que leriam de lá (nodemailer, pg, etc.)
for (const [k, v] of Object.entries(loaded)) {
  if (!process.env[k]) process.env[k] = v;
}

const env = (key) => getEnv(key, loaded);

// ---------------------------------------------------------------------------
// 1. Variáveis obrigatórias
// ---------------------------------------------------------------------------

const REQUIRED_VARS = [
  // API
  'NODE_ENV',
  // Database
  'DATABASE_URL',
  // Auth
  'JWT_SECRET',
  // CORS
  'ALLOWED_ORIGINS',
  // Postgres (docker-compose)
  'POSTGRES_PASSWORD',
  // Slack
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  // Equipe
  'TEAM_EMAIL_DOMAINS',
];

let hasErrors = false;

function checkRequired() {
  header('Variáveis obrigatórias');
  for (const key of REQUIRED_VARS) {
    const val = env(key);
    if (!val) {
      fail(`${key} — não definida`);
      hasErrors = true;
    } else {
      pass(`${key}`);
    }
  }

  // JWT_SECRET: mínimo 32 chars
  const jwtSecret = env('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) {
    fail(`JWT_SECRET — muito curto (${jwtSecret.length} chars; mínimo 32)`);
    hasErrors = true;
  }

  // NODE_ENV deve ser production (aviso, não erro)
  const nodeEnv = env('NODE_ENV');
  if (nodeEnv && nodeEnv !== 'production') {
    warn(`NODE_ENV="${nodeEnv}" — em produção deveria ser "production"`);
  }

  // COOKIE_SECURE deve ser true em prod
  const cookieSecure = env('COOKIE_SECURE');
  if (cookieSecure && cookieSecure !== 'true') {
    warn(`COOKIE_SECURE="${cookieSecure}" — em produção deveria ser "true"`);
  }
}

// ---------------------------------------------------------------------------
// 2. Conectividade Postgres
// ---------------------------------------------------------------------------

async function checkPostgres() {
  header('PostgreSQL');

  const databaseUrl = env('DATABASE_URL');
  if (!databaseUrl) {
    fail('DATABASE_URL não definida — pulando teste de conexão');
    hasErrors = true;
    return;
  }

  // Importar pg dinamicamente — pode não estar instalado globalmente
  let pg;
  try {
    pg = await import('pg');
  } catch {
    warn('Pacote "pg" não encontrado no contexto do script — pulando teste de conexão');
    warn('Dica: rode a partir da raiz do projeto após npm ci');
    return;
  }

  const { Pool } = pg.default ?? pg;
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
    max: 1,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      pass('Conexão estabelecida e SELECT 1 respondeu');
    } finally {
      client.release();
    }
  } catch (err) {
    fail(`Não foi possível conectar: ${err.message}`);
    hasErrors = true;
  } finally {
    await pool.end().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// 3. Slack auth.test
// ---------------------------------------------------------------------------

async function checkSlack() {
  const token = env('SLACK_BOT_TOKEN');
  if (!token) return; // já capturado em REQUIRED_VARS

  header('Slack');

  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      fail(`HTTP ${res.status} ao chamar auth.test`);
      hasErrors = true;
      return;
    }

    const body = await res.json();
    if (body.ok) {
      pass(`Token válido — team: ${body.team ?? '?'}, bot: ${body.user ?? '?'}`);
    } else {
      fail(`auth.test retornou ok=false: ${body.error ?? 'erro desconhecido'}`);
      hasErrors = true;
    }
  } catch (err) {
    fail(`Erro ao chamar Slack API: ${err.message}`);
    hasErrors = true;
  }
}

// ---------------------------------------------------------------------------
// 4. Telegram getMe
// ---------------------------------------------------------------------------

async function checkTelegram() {
  const enabled = env('TELEGRAM_ENABLED');
  if (!enabled || enabled.toLowerCase() !== 'true') return;

  header('Telegram');

  const botToken = env('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    fail('TELEGRAM_ENABLED=true mas TELEGRAM_BOT_TOKEN não definido');
    hasErrors = true;
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });

    const body = await res.json();
    if (body.ok) {
      pass(`Bot válido — @${body.result?.username ?? '?'}`);
    } else {
      fail(`getMe retornou ok=false: ${body.description ?? 'erro desconhecido'}`);
      hasErrors = true;
    }
  } catch (err) {
    fail(`Erro ao chamar Telegram API: ${err.message}`);
    hasErrors = true;
  }
}

// ---------------------------------------------------------------------------
// 5. SMTP
// ---------------------------------------------------------------------------

async function checkSmtp() {
  const smtpHost = env('SMTP_HOST');
  if (!smtpHost) return; // opcional

  header('SMTP');

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    warn('Pacote "nodemailer" não encontrado — pulando teste SMTP');
    return;
  }

  const nm = nodemailer.default ?? nodemailer;
  const transporter = nm.createTransport({
    host: smtpHost,
    port: parseInt(env('SMTP_PORT') || '587', 10),
    secure: env('SMTP_SECURE') === 'true',
    auth: env('SMTP_USER')
      ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') }
      : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 5000,
  });

  try {
    await transporter.verify();
    pass(`Conexão SMTP com ${smtpHost} estabelecida`);
  } catch (err) {
    fail(`Falha na conexão SMTP: ${err.message}`);
    hasErrors = true;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${BOLD}=== FlowDesk Pre-flight Check ===${RESET}`);

  checkRequired();
  await checkPostgres();
  await checkSlack();
  await checkTelegram();
  await checkSmtp();

  console.log('');

  if (hasErrors) {
    console.log(`${RED}${BOLD}Pre-flight FALHOU. Corrija os itens acima antes de subir os containers.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}Pre-flight OK. Pode subir os containers.${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Erro inesperado no pre-flight:', err);
  process.exit(1);
});
