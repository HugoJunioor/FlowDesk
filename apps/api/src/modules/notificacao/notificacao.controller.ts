/**
 * Controller de notificações.
 * Todos os endpoints exigem auth — usuário sempre vem de req.user.
 */
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@shared/domain/errors';
import { notificacaoService } from './notificacao.service';
import type {
  CreateNotificacaoInput,
  IdParam,
  PatchNotificacaoInput,
  PreferenciaInput,
} from './notificacao.dto';

function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const notificacaoController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const dados = await notificacaoService.listMine(user.email);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Cria sempre pra outro user (ex: notificacao a respeito de demanda
      // recem-atribuida). Quem chama eh um modulo interno que ja validou
      // o contexto. Mesmo assim exigimos auth — so usuarios autenticados
      // podem disparar notificacoes (anti-abuse).
      requireUser(req);
      const input = req.body as CreateNotificacaoInput;
      const dados = await notificacaoService.create(input);
      res.status(201).json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const { id } = req.params as unknown as IdParam;
      const { lida } = req.body as PatchNotificacaoInput;
      const dados = await notificacaoService.markRead(id, user.email, lida);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const dados = await notificacaoService.markAllRead(user.email);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async getPreferencia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const dados = await notificacaoService.getPreferencia(user.email);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async savePreferencia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireUser(req);
      const input = req.body as PreferenciaInput;
      const dados = await notificacaoService.savePreferencia(user.email, input);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },
};
