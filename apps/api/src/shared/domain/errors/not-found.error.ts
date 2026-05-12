import { DomainError } from './domain.error';

export class NotFoundError extends DomainError {
  constructor(recurso: string, identificador?: string | number) {
    super({
      mensagem: identificador
        ? `${recurso} com identificador "${identificador}" não encontrado`
        : `${recurso} não encontrado`,
      statusCode: 404,
      codigo: 'RECURSO_NAO_ENCONTRADO',
    });
    this.name = 'NotFoundError';
  }
}
