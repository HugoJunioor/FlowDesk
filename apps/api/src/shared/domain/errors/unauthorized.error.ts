import { DomainError } from './domain.error';

export class UnauthorizedError extends DomainError {
  constructor(mensagem = 'Não autenticado') {
    super({
      mensagem,
      statusCode: 401,
      codigo: 'NAO_AUTENTICADO',
    });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(mensagem = 'Sem permissão para esta operação') {
    super({
      mensagem,
      statusCode: 403,
      codigo: 'SEM_PERMISSAO',
    });
    this.name = 'ForbiddenError';
  }
}
