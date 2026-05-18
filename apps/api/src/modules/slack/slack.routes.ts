/**
 * Routes do módulo Slack.
 *
 * POST /api/v1/slack/events — endpoint da Slack Events API.
 *   Sem autenticacao JWT (endpoint público Slack), mas com validacao
 *   de assinatura HMAC via verifySlackSignature.
 *
 * IMPORTANTE: o body parser precisa preservar o rawBody (Buffer) antes
 * de fazer parse do JSON, pois o calculo de assinatura usa o body bruto.
 * Ver configuracao em apps/api/src/app.ts (verify callback do express.json).
 */
import { Router } from 'express';
import { verifySlackSignature } from './slack.signing';
import { slackController } from './slack.controller';

export const slackRoutes = Router();

slackRoutes.post('/events', verifySlackSignature, slackController.handleEvents);
