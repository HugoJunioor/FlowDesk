/**
 * DTOs do módulo Notificacao.
 *
 * Espelha o contrato atual do stateSync.mjs:
 * - GET /api/v1/notificacoes (lista do user logado)
 * - POST /api/v1/notificacoes (cria — usado por eventos internos)
 * - PATCH /api/v1/notificacoes/:id (marca lida/nao lida)
 * - POST /api/v1/notificacoes/mark-all-read
 * - GET/PUT /api/v1/notificacoes/preferences
 */
import { z } from 'zod';

export const NOTIFICATION_EVENTS = [
  'demand_assigned',
  'demand_replied',
  'demand_started',
  'demand_completed',
  'demand_reopened',
  'demand_overdue',
  'demand_due_soon',
  'demand_created',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const createNotificacaoSchema = z.object({
  usuarioEmail: z.string().email(),
  evento: z.enum(NOTIFICATION_EVENTS),
  origem: z.enum(['slack', 'infra']).default('slack'),
  demandaId: z.string().uuid().optional(),
  titulo: z.string().min(1).max(500),
  mensagem: z.string().max(2000).optional(),
  ator: z.string().max(200).optional(),
});
export type CreateNotificacaoInput = z.infer<typeof createNotificacaoSchema>;

export const patchNotificacaoSchema = z.object({
  lida: z.boolean(),
});
export type PatchNotificacaoInput = z.infer<typeof patchNotificacaoSchema>;

/** Entidade retornada pro frontend. */
export interface Notificacao {
  id: string;
  usuarioEmail: string;
  evento: NotificationEvent;
  origem: 'slack' | 'infra';
  demandaId: string | null;
  titulo: string;
  mensagem: string | null;
  ator: string | null;
  lida: boolean;
  lidaEm: Date | null;
  enviadaPor: string[] | null;
  criadoEm: Date;
}

/** Preferências de notificação por usuário. */
export const preferenciaSchema = z.object({
  eventos: z.record(z.string(), z.boolean()).default({}),
  canais: z.object({
    inbox: z.boolean().default(true),
    browserPush: z.boolean().default(false),
    email: z.boolean().default(false),
    telegram: z.boolean().default(true),
  }).default({ inbox: true, browserPush: false, email: false, telegram: true }),
  slaReminders: z.object({
    p1Hours: z.number().int().nonnegative().default(1),
    p2Hours: z.number().int().nonnegative().default(2),
    p3Hours: z.number().int().nonnegative().default(4),
  }).default({ p1Hours: 1, p2Hours: 2, p3Hours: 4 }),
  dailyReminder: z.boolean().default(true),
});
export type PreferenciaInput = z.infer<typeof preferenciaSchema>;

export interface Preferencia {
  usuarioEmail: string;
  eventos: Record<string, boolean>;
  canais: { inbox: boolean; browserPush: boolean; email: boolean; telegram: boolean };
  slaReminders: { p1Hours: number; p2Hours: number; p3Hours: number };
  dailyReminder: boolean;
}
