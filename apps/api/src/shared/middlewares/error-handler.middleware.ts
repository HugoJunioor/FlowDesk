/**
 * Error handler global. Toda rota chama next(err) — aqui mapeamos pro
 * envelope padronizado de erro.
 *
 * Convenção: erros conhecidos (DomainError) viram resposta limpa pro
 * cliente. Erros inesperados são logados com stack e retornam 500
 * genérico (não vazamos detalhes em produção).
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '@shared/domain/errors';
import { logger } from '@shared/logging/logger';
import { captureWithContext } from '@shared/observability/sentry';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.id;

  // Zod -> ValidationError
  if (err instanceof ZodError) {
    const detalhes = err.issues.map((i) => ({
      campo: i.path.join('.'),
      mensagem: i.message,
    }));
    res.status(400).json({
      erro: true,
      mensagem: 'Dados inválidos',
      codigo: 'VALIDACAO_FALHOU',
      detalhes,
      requestId,
    });
    return;
  }

  // Erros de domínio conhecidos
  if (err instanceof DomainError) {
    res.status(err.statusCode).json({
      erro: true,
      mensagem: err.message,
      codigo: err.codigo,
      detalhes: err.detalhes,
      requestId,
    });
    return;
  }

  // Erro não tratado — log completo, resposta genérica
  const e = err as Error;
  logger.error(
    {
      err: { message: e.message, stack: e.stack, name: e.name },
      requestId,
      method: req.method,
      url: req.originalUrl,
    },
    'Erro não tratado',
  );
  // Captura no Sentry se DSN estiver configurada (no-op caso contrario)
  captureWithContext(err, req);

  res.status(500).json({
    erro: true,
    mensagem: 'Erro interno do servidor',
    codigo: 'ERRO_INTERNO',
    requestId,
  });
}
