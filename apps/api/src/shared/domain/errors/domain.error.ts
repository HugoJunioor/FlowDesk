/**
 * Hierarquia de erros de domínio.
 *
 * Tudo que é erro de negócio (não bug) deve herdar de DomainError. O
 * error-handler middleware mapeia para o status HTTP correto e retorna
 * o envelope padronizado pro cliente.
 *
 * Regras:
 *  - statusCode é HTTP — usado direto pelo middleware
 *  - codigo é máquina-legível em SNAKE_CASE (front consome pra i18n / UI)
 *  - mensagem é humana, em pt-BR
 *  - detalhes é opcional, pode conter contexto (ex: array de field errors)
 */
export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly codigo: string;
  public readonly detalhes?: unknown;

  constructor(opts: {
    mensagem: string;
    statusCode: number;
    codigo: string;
    detalhes?: unknown;
  }) {
    super(opts.mensagem);
    this.name = 'DomainError';
    this.statusCode = opts.statusCode;
    this.codigo = opts.codigo;
    this.detalhes = opts.detalhes;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
