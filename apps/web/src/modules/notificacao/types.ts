/**
 * Types do modulo Notificacao. Espelha
 * apps/api/src/modules/notificacao/notificacao.dto.ts.
 */
export type NotificationEvent =
  | 'demand_assigned'
  | 'demand_replied'
  | 'demand_started'
  | 'demand_completed'
  | 'demand_reopened'
  | 'demand_overdue'
  | 'demand_due_soon'
  | 'demand_created';

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
  lidaEm: string | null;
  enviadaPor: string[] | null;
  criadoEm: string;
}

export interface Preferencia {
  usuarioEmail: string;
  eventos: Record<string, boolean>;
  canais: { inbox: boolean; browserPush: boolean; email: boolean };
  slaReminders: { p1Hours: number; p2Hours: number; p3Hours: number };
}

export interface PreferenciaInput {
  eventos: Record<string, boolean>;
  canais: { inbox: boolean; browserPush: boolean; email: boolean };
  slaReminders: { p1Hours: number; p2Hours: number; p3Hours: number };
}
