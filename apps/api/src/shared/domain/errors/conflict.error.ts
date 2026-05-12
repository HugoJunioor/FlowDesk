import { DomainError } from './domain.error';

export class ConflictError extends DomainError {
  constructor(mensagem: string, codigo = 'CONFLITO') {
    super({
      mensagem,
      statusCode: 409,
      codigo,
    });
    this.name = 'ConflictError';
  }
}
