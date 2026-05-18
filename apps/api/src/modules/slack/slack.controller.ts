/**
 * Controller do módulo Slack — adapta HTTP ↔ slackService.
 *
 * Endpoint único: POST /api/v1/slack/events
 *   - Slack chama esse endpoint para url_verification e para eventos reais.
 *   - Assinatura já foi validada pelo middleware verifySlackSignature antes.
 *   - Resposta deve ser 200 em até 3s (Slack retenta caso contrário).
 */
import type { Request, Response, NextFunction } from 'express';
import { slackService } from './slack.service';
import { slackInboundSchema } from './slack.schemas';

export const slackController = {
  async handleEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = slackInboundSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({ sucesso: false, erro: 'Payload invalido' });
        return;
      }

      const payload = parsed.data;

      // url_verification: responde imediatamente com o challenge
      if (payload.type === 'url_verification') {
        const result = slackService.handleUrlVerification(payload);
        res.json(result);
        return;
      }

      // Demais eventos: processa e responde 200 rapidamente
      const { deduplicated } = await slackService.handleEvent(payload);

      res.json({ sucesso: true, deduplicated });
    } catch (err) {
      next(err);
    }
  },
};
