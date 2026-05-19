/**
 * Health check da API.
 *
 * `/health` é público (sem auth) para integrar com monitoring externo,
 * load balancer e k8s readiness probe.
 *
 * Convencional: 200 + JSON com status, version, uptime.
 *
 * Rotas:
 *   GET /health          — ping rápido (sem I/O)
 *   GET /health/detailed — checks profundos: DB, disco, memória
 */
import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { freemem } from 'node:os';
import rateLimit from 'express-rate-limit';
import type { PoolClient } from 'pg';
import { pool } from '@config/database';
import { env } from '@config/env';

// ---------------------------------------------------------------------------
// Helpers compartilhados
// ---------------------------------------------------------------------------

let cachedVersion: string | undefined;
function getVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8')) as {
      version?: string;
    };
    cachedVersion = pkg.version ?? 'unknown';
    return cachedVersion;
  } catch {
    return 'unknown';
  }
}

const startedAt = new Date().toISOString();

// ---------------------------------------------------------------------------
// Rate limit específico para /health/detailed
// ---------------------------------------------------------------------------
const detailedRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: true, mensagem: 'Muitas requisicoes', codigo: 'RATE_LIMIT' },
});

// ---------------------------------------------------------------------------
// Checks individuais
// ---------------------------------------------------------------------------

interface DbCheck {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

async function checkDatabase(): Promise<DbCheck> {
  const start = Date.now();
  let client: PoolClient | undefined;
  try {
    // Conecta e executa SELECT 1 com timeout de 1s via statement_timeout
    client = await pool.connect();
    await client.query('SET statement_timeout = 1000; SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'erro desconhecido',
    };
  } finally {
    try {
      client?.release();
    } catch {
      // ignora erro de release
    }
  }
}

interface DiskCheck {
  ok: boolean;
  freeGb: number;
  error?: string;
}

async function checkDisk(): Promise<DiskCheck> {
  try {
    const stats = await statfs('/');
    const freeBytes = stats.bfree * stats.bsize;
    const freeGb = Math.round((freeBytes / 1024 ** 3) * 10) / 10;
    // Degradado se menos de 1 GB livre
    return { ok: freeGb >= 1, freeGb };
  } catch {
    // statfs falhou (ex.: Windows local) — fallback via os.freemem
    const freeGb = Math.round((freemem() / 1024 ** 3) * 10) / 10;
    return { ok: freeGb >= 0.5, freeGb };
  }
}

interface MemoryCheck {
  ok: boolean;
  usedMb: number;
  heapMb: number;
}

function checkMemory(): MemoryCheck {
  const mem = process.memoryUsage();
  const usedMb = Math.round(mem.rss / 1024 ** 2);
  const heapMb = Math.round(mem.heapUsed / 1024 ** 2);
  // Degradado se heap > 1.5 GB (sinal de memory leak grave)
  return { ok: heapMb < 1_536, usedMb, heapMb };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const healthRoutes = Router();

// GET /health — ping rápido, sem I/O
healthRoutes.get('/', (_req, res) => {
  res.json({
    sucesso: true,
    dados: {
      status: 'ok',
      version: getVersion(),
      startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

// GET /health/detailed — checks profundos
healthRoutes.get('/detailed', detailedRateLimit, async (_req, res) => {
  const [db, disk] = await Promise.all([checkDatabase(), checkDisk()]);
  const memory = checkMemory();

  const allOk = db.ok && disk.ok && memory.ok;
  const status: 'ok' | 'degraded' = allOk ? 'ok' : 'degraded';

  const dbResult: { ok: boolean; latencyMs: number; error?: string } = {
    ok: db.ok,
    latencyMs: db.latencyMs,
  };
  if (db.error !== undefined) dbResult.error = db.error;

  const diskResult: { ok: boolean; freeGb: number; error?: string } = {
    ok: disk.ok,
    freeGb: disk.freeGb,
  };
  if (disk.error !== undefined) diskResult.error = disk.error;

  res.json({
    sucesso: true,
    dados: {
      status,
      uptime: Math.floor(process.uptime()),
      version: getVersion(),
      checks: {
        database: dbResult,
        disk: diskResult,
        memory: { ok: memory.ok, usedMb: memory.usedMb, heapMb: memory.heapMb },
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Router: GET /api/v1/version
// ---------------------------------------------------------------------------

export const versionRoutes = Router();

// GET / — versão da aplicação, commit e info de runtime.
// Variáveis BUILD_SHA e BUILD_DATE são injetadas pelo CI no build de produção.
versionRoutes.get('/', (_req, res) => {
  res.json({
    sucesso: true,
    dados: {
      version: getVersion(),
      commit: env.BUILD_SHA ?? 'local',
      buildDate: env.BUILD_DATE ?? null,
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
    },
  });
});
