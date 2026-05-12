/**
 * Atribui um X-Request-ID único a cada request (ou propaga se cliente
 * mandou). Disponibiliza em req.id para logs estruturados.
 */
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-ID');
  const id = incoming && /^[\w-]{8,128}$/.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
