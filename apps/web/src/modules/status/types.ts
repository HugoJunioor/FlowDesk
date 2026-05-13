/**
 * Types do módulo Status — health check da API.
 */
export interface ApiHealth {
  status: 'ok' | string;
  version: string;
  startedAt: string;
  uptimeSeconds: number;
}
