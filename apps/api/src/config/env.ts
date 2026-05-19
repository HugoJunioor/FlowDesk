/**
 * Validação fail-fast das variáveis de ambiente.
 *
 * Se .env estiver com campo faltando ou inválido, o processo sai com erro
 * claro no boot — nunca em runtime.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL obrigatório'),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_DOMAIN: z.string().optional(),

  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:4173')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),

  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WRITE: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_READ: z.coerce.number().int().positive().default(300),

  // Sentry — opt-in. Sem DSN, observability fica desligado (zero overhead).
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_ENVIRONMENT: z.string().optional(),

  // OpenAPI / Swagger UI. Default true em dev/staging, false em prod.
  OPENAPI_ENABLED: z.coerce.boolean().default(true),

  // Build info — injetado pelo CI (ex: BUILD_SHA=$(git rev-parse --short HEAD)).
  BUILD_SHA: z.string().optional(),
  BUILD_DATE: z.string().optional(),

  // Cron de SLA reminders. Em prod recomendado true; em dev pode ficar false.
  SLA_CRON_ENABLED: z.coerce.boolean().default(false),
  /** Intervalo em segundos entre runs do cron */
  SLA_CRON_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),

  // Lembrete diário por e-mail (cron 9h dias úteis).
  DAILY_REMINDER_ENABLED: z.coerce.boolean().default(false),

  // SMTP — se algum ausente, entra em dry-run (só loga, não envia).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('FlowDesk <noreply@flowdesk.local>'),

  // URL base usada nos links em e-mails / notificacoes externas
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),

  // Telegram Bot — opt-in. Sem TELEGRAM_ENABLED=true, módulo carrega mas retorna 503.
  TELEGRAM_ENABLED: z.coerce.boolean().default(false),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default('FlowDeskBot'),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
}).superRefine((data, ctx) => {
  if (data.TELEGRAM_ENABLED) {
    if (!data.TELEGRAM_BOT_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_BOT_TOKEN'],
        message: 'TELEGRAM_BOT_TOKEN obrigatório quando TELEGRAM_ENABLED=true',
      });
    }
    if (!data.TELEGRAM_WEBHOOK_SECRET || data.TELEGRAM_WEBHOOK_SECRET.length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'TELEGRAM_WEBHOOK_SECRET obrigatório (mínimo 16 chars) quando TELEGRAM_ENABLED=true',
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
