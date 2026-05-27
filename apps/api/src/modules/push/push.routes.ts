/**
 * Routes Web Push.
 *
 * GET    /push/public-key             — retorna VAPID public key (auth opcional)
 * POST   /push/subscribe              (auth) — registra subscription do user
 * POST   /push/unsubscribe            (auth) — remove subscription por endpoint
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '@modules/auth/auth.middleware';
import { pushService } from './push.service';

export const pushRoutes = Router();

pushRoutes.get('/public-key', (_req: Request, res: Response) => {
  res.json({ sucesso: true, dados: { publicKey: pushService.getPublicKey() } });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

pushRoutes.post('/subscribe', authenticate, async (req: Request, res: Response) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      erro: true,
      mensagem: 'Payload inválido',
      codigo: 'PAYLOAD_INVALIDO',
      detalhes: parsed.error.issues,
    });
    return;
  }
  const userEmail = (req as { user?: { email?: string } }).user?.email;
  if (!userEmail) {
    res.status(401).json({ erro: true, mensagem: 'Não autenticado', codigo: 'SEM_AUTH' });
    return;
  }
  await pushService.subscribe(
    userEmail,
    { endpoint: parsed.data.endpoint, keys: parsed.data.keys },
    parsed.data.userAgent ?? req.headers['user-agent'],
  );
  res.json({ sucesso: true });
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

pushRoutes.post('/unsubscribe', authenticate, async (req: Request, res: Response) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erro: true, mensagem: 'Endpoint inválido', codigo: 'PAYLOAD_INVALIDO' });
    return;
  }
  await pushService.unsubscribe(parsed.data.endpoint);
  res.json({ sucesso: true });
});
