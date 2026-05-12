import { DomainError } from './domain.error';

export class ValidationError extends DomainError {
  constructor(mensagem: string, detalhes?: unknown) {
    super({
      mensagem,
      statusCode: 400,
      codigo: 'VALIDACAO_FALHOU',
      detalhes,
    });
    this.name = 'ValidationError';
  }
}
