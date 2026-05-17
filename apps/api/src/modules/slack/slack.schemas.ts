/**
 * Zod schemas para payloads da Slack Events API.
 *
 * Referência: https://api.slack.com/apis/connections/events-api
 * Validamos apenas o que consumimos — campos desconhecidos passam (passthrough).
 */
import { z } from 'zod';

// ── Envelope comum a todos os eventos ──────────────────────────────────────

export const slackEnvelopeSchema = z.object({
  token: z.string().optional(),
  team_id: z.string().optional(),
  api_app_id: z.string().optional(),
  type: z.string(),
  event_id: z.string().optional(),
  event_time: z.number().optional(),
});

// ── url_verification ───────────────────────────────────────────────────────

export const slackUrlVerificationSchema = z.object({
  type: z.literal('url_verification'),
  challenge: z.string(),
  token: z.string().optional(),
});
export type SlackUrlVerification = z.infer<typeof slackUrlVerificationSchema>;

// ── Evento message ─────────────────────────────────────────────────────────

export const slackMessageEventSchema = z.object({
  type: z.literal('message'),
  subtype: z.string().optional(),
  channel: z.string(),
  channel_type: z.string().optional(),
  user: z.string().optional(),
  bot_id: z.string().optional(),
  text: z.string().optional(),
  ts: z.string(),
  thread_ts: z.string().optional(),
  permalink: z.string().optional(),
});
export type SlackMessageEvent = z.infer<typeof slackMessageEventSchema>;

// ── Evento reaction_added / reaction_removed ───────────────────────────────

export const slackReactionEventSchema = z.object({
  type: z.enum(['reaction_added', 'reaction_removed']),
  user: z.string(),
  reaction: z.string(),
  item: z.object({
    type: z.string(),
    channel: z.string(),
    ts: z.string(),
  }),
  item_user: z.string().optional(),
  event_ts: z.string(),
});
export type SlackReactionEvent = z.infer<typeof slackReactionEventSchema>;

// ── Evento channel_created ─────────────────────────────────────────────────

export const slackChannelCreatedEventSchema = z.object({
  type: z.literal('channel_created'),
  channel: z.object({
    id: z.string(),
    name: z.string(),
    created: z.number(),
    creator: z.string().optional(),
  }),
});
export type SlackChannelCreatedEvent = z.infer<typeof slackChannelCreatedEventSchema>;

// ── Wrapper event_callback ─────────────────────────────────────────────────

export const slackEventCallbackSchema = slackEnvelopeSchema.extend({
  type: z.literal('event_callback'),
  event: z.unknown(),
});
export type SlackEventCallback = z.infer<typeof slackEventCallbackSchema>;

// ── Payload de entrada (discriminated) ────────────────────────────────────

export const slackInboundSchema = z.discriminatedUnion('type', [
  slackUrlVerificationSchema,
  slackEventCallbackSchema,
]);
export type SlackInbound = z.infer<typeof slackInboundSchema>;
