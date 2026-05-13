/**
 * Controller do Auth.
 *
 * Endpoints HTTP → service. O refresh token nunca aparece no body
 * — sai em HttpOnly cookie. O access token sai em JSON pro client
 * usar em Authorization: Bearer.
 */
import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { env } from '@config/env';
import { authService } from './auth.service';
import type { ChangePasswordInput, LoginInput } from './auth.dto';

const REFRESH_COOKIE = 'fd_refresh';

function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: maxAgeMs,
    domain: env.COOKIE_DOMAIN || undefined,
  };
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as LoginInput;
      const result = await authService.login(input, {
        userAgent: req.header('user-agent') ?? undefined,
        ip: req.ip,
      });
      const maxAge = result.refreshExpiresAt.getTime() - Date.now();
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(maxAge));
      res.json({ sucesso: true, dados: result.auth });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
      const result = await authService.refresh(cookie ?? '', {
        userAgent: req.header('user-agent') ?? undefined,
        ip: req.ip,
      });
      const maxAge = result.refreshExpiresAt.getTime() - Date.now();
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(maxAge));
      res.json({ sucesso: true, dados: result.auth });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
      await authService.logout(cookie);
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.json({ sucesso: true, dados: { mensagem: 'Logout efetuado' } });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // auth.middleware ja populou req.user — mas refetch garante dados frescos
      if (!req.user) {
        res.status(401).json({ erro: true, mensagem: 'Não autenticado', codigo: 'NAO_AUTENTICADO' });
        return;
      }
      const dados = await authService.getMe(req.user.id);
      res.json({ sucesso: true, dados });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ erro: true, mensagem: 'Não autenticado', codigo: 'NAO_AUTENTICADO' });
        return;
      }
      const input = req.body as ChangePasswordInput;
      await authService.changePassword(req.user.id, input);
      // Limpa o refresh atual — usuario precisa re-logar nesse device tambem
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.json({ sucesso: true, dados: { mensagem: 'Senha alterada com sucesso. Faça login novamente.' } });
    } catch (err) {
      next(err);
    }
  },
};
