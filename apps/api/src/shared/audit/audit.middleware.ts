/**
 * Middleware de auditoria automática.
 *
 * Captura todas as mutations (POST/PUT/PATCH/DELETE) de rotas relevantes
 * APÓS o response — registra recurso (inferido pela URL) + action (pelo
 * method) + status + user.
 *
 * Para registros enriquecidos com payload antes/depois, services chamam
 * auditService.log() explicitamente (ex: login, mudanca de senha).
 */
import type { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Rotas que NÃO devem ser auditadas (ruído, alta frequência, etc) */
const SKIP_PATHS = [
  '/health',
  '/healthz',
  '/auth/refresh', // muito frequente; o login/logout já registra
];

interface RouteMatch {
  recurso: string;
  recursoId: string | null;
}

/**
 * Infere recurso e id a partir da URL.
 * Ex: /api/v1/notas/uuid-1/items/uuid-2 → { recurso: 'nota', recursoId: 'uuid-1' }
 */
function inferRoute(url: string): RouteMatch | null {
  const m = /^\/api\/v\d+\/([a-z_-]+)(?:\/([0-9a-f-]{8,}))?/i.exec(url);
  if (!m) return null;
  const path = m[1] ?? '';
  // Mapa de plural -> singular pra recurso "limpo"
  const mapa: Record<string, string> = {
    auth: 'auth',
    notas: 'nota',
    notificacoes: 'notificacao',
    demandas: 'demanda',
    templates: 'template',
    usuarios: 'usuario',
    grupos: 'grupo',
  };
  return {
    recurso: mapa[path] ?? path,
    recursoId: m[2] ?? null,
  };
}

function inferAcao(method: string, url: string): string {
  // Actions especiais detectadas via path
  if (/\/atender$/i.test(url)) return 'atender';
  if (/\/concluir$/i.test(url)) return 'concluir';
  if (/\/mark-all-read$/i.test(url)) return 'mark_all_read';
  if (/\/replies$/i.test(url) && method === 'POST') return 'add_reply';
  if (/\/closure$/i.test(url)) return 'update_closure';
  if (/\/change-password$/i.test(url)) return 'change_password';
  if (/\/login$/i.test(url)) return 'login';
  if (/\/logout$/i.test(url)) return 'logout';

  switch (method) {
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return method.toLowerCase();
  }
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATION_METHODS.has(req.method)) return next();
  if (SKIP_PATHS.some((p) => req.path.startsWith(p) || req.originalUrl.includes(p))) {
    return next();
  }

  // Registra DEPOIS da resposta — só sucesso (2xx) ou criação (201)
  res.on('finish', () => {
    if (res.statusCode >= 400) return; // erros já são logados pelo Pino
    const route = inferRoute(req.originalUrl);
    if (!route) return;

    auditService.log({
      req,
      recurso: route.recurso,
      recursoId: route.recursoId,
      acao: inferAcao(req.method, req.originalUrl),
      // Não persistimos body completo — só uma referência. Services que
      // precisam de antes/depois detalhado chamam auditService.log() explicitamente.
    });
  });

  next();
}
