/**
 * Middleware genérico de validação Zod.
 *
 * Uso nas rotas:
 *   router.post('/', validate({ body: createSchema }), controller.create);
 *
 * Substitui os campos req.body / req.query / req.params pelos valores
 * já parseados (com defaults, coercões, etc.). Se inválido, passa
 * ZodError pro error-handler.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        Object.assign(req.query, schemas.query.parse(req.query));
      }
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
