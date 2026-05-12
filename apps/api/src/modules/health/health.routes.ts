/**
 * Health check da API.
 *
 * `/health` é público (sem auth) para integrar com monitoring externo,
 * load balancer e k8s readiness probe.
 *
 * Convencional: 200 + JSON com status, version, uptime.
 */
import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let cachedVersion: string | undefined;
function getVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8'));
    cachedVersion = pkg.version as string;
    return cachedVersion;
  } catch {
    return 'unknown';
  }
}

const startedAt = new Date().toISOString();

export const healthRoutes = Router();

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
