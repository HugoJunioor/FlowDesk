/**
 * Sistema de notificacoes do FlowDesk.
 *
 * Cada notificacao representa um evento relevante pra um usuario especifico:
 * demanda atribuida, respondida, concluida, SLA vencendo, etc.
 *
 * Persistencia: data/notifications.json (sincronizada via stateSync plugin).
 * Cada usuario filtra as proprias por userEmail.
 */

export type NotificationEvent =
  | "demand_assigned"      // Demanda atribuida a voce
  | "demand_replied"       // Resposta nova em demanda sua
  | "demand_started"       // Atendimento iniciado (em_andamento)
  | "demand_completed"     // Demanda concluida
  | "demand_reopened"      // Demanda reaberta
  | "demand_overdue"       // SLA estourado
  | "demand_due_soon"      // SLA vencendo (configuravel: X horas antes)
  | "demand_created"       // Nova demanda criada (pra time de infra/sql)
  | "demand_approved"      // Demanda SQL/Deploy aprovada pelo aprovador
  | "demand_rejected";     // Demanda SQL/Deploy reprovada pelo aprovador

export type NotificationChannel = "inbox" | "browser_push" | "email" | "telegram";

/** Chave usada nos objetos channels/eventsByChannel (camelCase). */
export type ChannelKey = "inbox" | "browserPush" | "email" | "telegram";

export interface NotificationItem {
  id: string;
  /** Email do destinatario (FlowDesk user) */
  userEmail: string;
  /** Tipo de evento */
  event: NotificationEvent;
  /** Origem da demanda referenciada */
  source: "slack" | "infra";
  /** ID da demanda referenciada (pra clicar e abrir) */
  demandId: string;
  /** Titulo curto pra exibicao */
  title: string;
  /** Mensagem mais detalhada */
  message: string;
  /** Quem disparou (autor do evento) */
  actor?: string;
  /** Quando aconteceu */
  createdAt: string;
  /** Foi lida? (false = bold no inbox) */
  read: boolean;
  /** Quando foi lida (se aplicavel) */
  readAt?: string;
  /** Canais por onde foi notificada (pra evitar duplicidade) */
  sentVia?: NotificationChannel[];
}

/**
 * Preferencias de notificacao por usuario.
 * Configurado em /perfil/notificacoes.
 *
 * Defaults: tudo ligado no inbox, push e e-mail desligados por padrao
 * (user opta-in nos canais que quer).
 */
export interface NotificationPreferences {
  /** Email do usuario (chave) */
  userEmail: string;
  /** Por evento — defaults globais. Cada canal pode sobrescrever via eventsByChannel. */
  events: Partial<Record<NotificationEvent, boolean>>;
  /** Canais ativos globalmente (master switch) */
  channels: {
    inbox: boolean;
    browserPush: boolean;
    email: boolean;
    telegram: boolean;
  };
  /**
   * Override de eventos por canal. Se a chave estiver presente, vence sobre `events`.
   * Se ausente, usa `events` (global).
   *
   * Ex: { email: { demand_replied: false } } => email NAO envia em respostas
   * mesmo que events.demand_replied seja true.
   */
  eventsByChannel?: Partial<Record<ChannelKey, Partial<Record<NotificationEvent, boolean>>>>;
  /** Lembretes SLA: quantas horas antes do vencimento notificar (por prioridade) */
  slaReminders: {
    p1Hours: number;  // ex: 1 hora antes
    p2Hours: number;  // ex: 2 horas antes
    p3Hours: number;  // ex: 4 horas antes
  };
  /** Resumo diário por e-mail às 9h (dias úteis) */
  dailyReminder: boolean;
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "userEmail"> = {
  events: {
    demand_assigned: true,
    demand_replied: true,
    demand_started: true,
    demand_completed: true,
    demand_reopened: true,
    demand_overdue: true,
    demand_due_soon: true,
    demand_created: false,  // ruido pro time, off por default
    demand_approved: true,
    demand_rejected: true,
  },
  channels: {
    inbox: true,         // sempre ligado
    browserPush: false,  // opt-in
    email: false,        // opt-in
    telegram: true,      // se conectado, envia por default
  },
  slaReminders: {
    p1Hours: 1,
    p2Hours: 2,
    p3Hours: 4,
  },
  dailyReminder: true,
};

/**
 * Resolve se um evento deve disparar pra um canal específico.
 * Regra: prefs.eventsByChannel[channel][event] vence sobre prefs.events[event].
 * Se nenhum dos dois definir, retorna true (default permissivo).
 */
export function isEventEnabledForChannel(
  prefs: NotificationPreferences | null | undefined,
  channel: ChannelKey,
  event: NotificationEvent,
): boolean {
  if (!prefs) return true;
  const override = prefs.eventsByChannel?.[channel]?.[event];
  if (override !== undefined) return override;
  const global = prefs.events?.[event];
  return global !== false; // undefined ou true => permite
}

export const EVENT_LABELS: Record<NotificationEvent, { label: string; icon: string }> = {
  demand_assigned: { label: "Atribuída a você", icon: "UserCheck" },
  demand_replied: { label: "Resposta nova", icon: "MessageSquare" },
  demand_started: { label: "Atendimento iniciado", icon: "Loader2" },
  demand_completed: { label: "Demanda concluída", icon: "CheckCircle2" },
  demand_reopened: { label: "Demanda reaberta", icon: "RotateCcw" },
  demand_overdue: { label: "SLA estourado", icon: "AlertCircle" },
  demand_due_soon: { label: "SLA vencendo", icon: "Clock" },
  demand_created: { label: "Nova demanda criada", icon: "Plus" },
  demand_approved: { label: "Demanda aprovada", icon: "ThumbsUp" },
  demand_rejected: { label: "Demanda reprovada", icon: "ThumbsDown" },
};
