/**
 * Service do módulo Slack — processa eventos da Slack Events API.
 *
 * Regras:
 *   - Deduplicacao via LRU em memória (10k event_ids).
 *   - Eventos desconhecidos: log + retorna sem erro (200 OK).
 *   - Delega criacao/atualizacao de demanda ao pool existente.
 *   - Canais elegíveis: nome começa com "cliente-".
 *
 * Emojis de conclusao (em linha com syncSlack.cjs):
 *   - large_green_circle (primário no projeto)
 *   - white_check_mark   (aceito também via Events API)
 */
import { pool } from '@config/database';
import { logger } from '@shared/logging/logger';
import type {
  SlackChannelCreatedEvent,
  SlackEventCallback,
  SlackInbound,
  SlackMessageEvent,
  SlackReactionEvent,
  SlackUrlVerification,
} from './slack.schemas';
import {
  slackChannelCreatedEventSchema,
  slackMessageEventSchema,
  slackReactionEventSchema,
} from './slack.schemas';

// ── LRU em memória para deduplicação ──────────────────────────────────────

const MAX_SEEN = 10_000;
const seenEventIds = new Map<string, true>();

function markSeen(id: string): boolean {
  if (seenEventIds.has(id)) return true; // já visto

  seenEventIds.set(id, true);

  // Limita tamanho: remove o item mais antigo quando passa do limite
  if (seenEventIds.size > MAX_SEEN) {
    const firstKey = seenEventIds.keys().next().value;
    if (firstKey !== undefined) seenEventIds.delete(firstKey);
  }

  return false;
}

// ── Emojis ────────────────────────────────────────────────────────────────

const COMPLETION_REACTIONS = new Set(['large_green_circle', 'white_check_mark']);

// ── Helpers de canal ──────────────────────────────────────────────────────

function isClienteChannel(channelName: string): boolean {
  return channelName.toLowerCase().startsWith('cliente-');
}

// ── Handlers de evento ────────────────────────────────────────────────────

async function handleMessage(event: SlackMessageEvent, channelName?: string): Promise<void> {
  // Só processa mensagens bot (workflow Slack) com texto relevante
  const isBot = event.subtype === 'bot_message' || !!event.bot_id;
  if (!isBot) return;

  if (!channelName || !isClienteChannel(channelName)) return;

  const text = event.text ?? '';
  const textLower = text.toLowerCase();
  const isDemand =
    textLower.includes('nova demanda') ||
    textLower.includes('solicitação') ||
    textLower.includes('solicitacao') ||
    textLower.includes('título da demanda') ||
    textLower.includes('titulo da demanda') ||
    textLower.includes('demanda enviada');

  if (!isDemand) return;

  // Extrai título: primeira linha não vazia como fallback
  const titulo =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0)
      ?.slice(0, 500) ?? 'Demanda via Slack';

  const threadTs = event.thread_ts ?? event.ts;

  // Upsert baseado em canal_slack + permalink_slack (ts único no canal)
  try {
    await pool.query(
      `INSERT INTO tb_demanda
         (titulo, descricao, prioridade, status, origem,
          canal_slack, permalink_slack, tags)
       VALUES ($1, $2, 'sem_classificacao', 'aberta', 'slack', $3, $4, '{}')
       ON CONFLICT (canal_slack, permalink_slack) DO NOTHING`,
      [titulo, text.slice(0, 20_000), channelName, threadTs],
    );

    logger.info(
      { canal: channelName, ts: event.ts },
      'slack.service: demanda criada/ignorada via webhook',
    );
  } catch (err) {
    logger.error({ err, canal: channelName }, 'slack.service: erro ao upsert demanda');
    throw err;
  }
}

async function handleReactionAdded(event: SlackReactionEvent): Promise<void> {
  if (!COMPLETION_REACTIONS.has(event.reaction)) return;

  const { channel, ts } = event.item;

  try {
    const res = await pool.query<{ id: string }>(
      `UPDATE tb_demanda
          SET status = 'concluida', concluida_em = NOW(), atualizado_em = NOW()
        WHERE canal_slack IS NOT NULL
          AND permalink_slack = $1
          AND excluido_em IS NULL
        RETURNING id`,
      [ts],
    );

    if ((res.rowCount ?? 0) > 0) {
      logger.info(
        { canal: channel, ts, reaction: event.reaction },
        'slack.service: demanda concluida via reaction',
      );
    }
  } catch (err) {
    logger.error({ err, channel, ts }, 'slack.service: erro ao concluir demanda via reaction');
    throw err;
  }
}

async function handleReactionRemoved(event: SlackReactionEvent): Promise<void> {
  if (!COMPLETION_REACTIONS.has(event.reaction)) return;

  const { channel, ts } = event.item;

  try {
    const res = await pool.query<{ id: string }>(
      `UPDATE tb_demanda
          SET status = 'aberta', concluida_em = NULL, atualizado_em = NOW()
        WHERE canal_slack IS NOT NULL
          AND permalink_slack = $1
          AND status = 'concluida'
          AND excluido_em IS NULL
        RETURNING id`,
      [ts],
    );

    if ((res.rowCount ?? 0) > 0) {
      logger.info(
        { canal: channel, ts, reaction: event.reaction },
        'slack.service: demanda reaberta via reaction_removed',
      );
    }
  } catch (err) {
    logger.error({ err, channel, ts }, 'slack.service: erro ao reabrir demanda');
    throw err;
  }
}

function handleChannelCreated(event: SlackChannelCreatedEvent): void {
  if (isClienteChannel(event.channel.name)) {
    logger.info(
      { channelId: event.channel.id, name: event.channel.name },
      'slack.service: novo canal cliente criado',
    );
  }
}

// ── Entry point principal ─────────────────────────────────────────────────

export const slackService = {
  /**
   * Responde ao challenge de url_verification do Slack.
   */
  handleUrlVerification(payload: SlackUrlVerification): { challenge: string } {
    logger.info('slack.service: url_verification recebido');
    return { challenge: payload.challenge };
  },

  /**
   * Processa um evento inbound. Retorna false se foi deduplicado.
   */
  async handleEvent(payload: SlackInbound): Promise<{ deduplicated: boolean }> {
    if (payload.type === 'url_verification') {
      // Não deve chegar aqui, mas defensivo
      return { deduplicated: false };
    }

    const callback = payload as SlackEventCallback;
    const eventId = callback.event_id;

    // Deduplicação
    if (eventId && markSeen(eventId)) {
      logger.debug({ eventId }, 'slack.service: evento duplicado ignorado');
      return { deduplicated: true };
    }

    const rawEvent = callback.event as Record<string, unknown>;
    const eventType = rawEvent?.type as string | undefined;

    switch (eventType) {
      case 'message': {
        const parsed = slackMessageEventSchema.safeParse(rawEvent);
        if (!parsed.success) {
          logger.warn({ issues: parsed.error.issues }, 'slack.service: message event invalido');
          break;
        }
        // channelName pode vir no event ou precisaria de lookup via API;
        // para webhook, o campo channel é o ID. Tentamos pegar pelo nome
        // armazenado se disponível, senão usamos o ID como fallback.
        const channelName =
          (rawEvent.channel_name as string | undefined) ??
          (rawEvent.channel as string | undefined) ??
          '';
        await handleMessage(parsed.data, channelName);
        break;
      }

      case 'reaction_added': {
        const parsed = slackReactionEventSchema.safeParse(rawEvent);
        if (!parsed.success) {
          logger.warn({ issues: parsed.error.issues }, 'slack.service: reaction_added invalido');
          break;
        }
        await handleReactionAdded(parsed.data);
        break;
      }

      case 'reaction_removed': {
        const parsed = slackReactionEventSchema.safeParse(rawEvent);
        if (!parsed.success) {
          logger.warn({ issues: parsed.error.issues }, 'slack.service: reaction_removed invalido');
          break;
        }
        await handleReactionRemoved(parsed.data);
        break;
      }

      case 'channel_created': {
        const parsed = slackChannelCreatedEventSchema.safeParse(rawEvent);
        if (!parsed.success) {
          logger.warn({ issues: parsed.error.issues }, 'slack.service: channel_created invalido');
          break;
        }
        handleChannelCreated(parsed.data);
        break;
      }

      default:
        logger.debug({ eventType, eventId }, 'slack.service: evento nao tratado, ignorando');
    }

    return { deduplicated: false };
  },
};
