/**
 * Testes unitários do service do _template.
 *
 * Mocka o repository — não toca em banco real. Pra testes de integração
 * com Postgres (mais lentos, exigem DB up), criar __tests__/integration/.
 */
import { templateService } from '../_template.service';
import { templateRepository } from '../_template.repository';
import { NotFoundError } from '@shared/domain/errors';

jest.mock('../_template.repository');

const repoMock = templateRepository as jest.Mocked<typeof templateRepository>;

describe('templateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create chama o repository e retorna a entidade', async () => {
    const fakeCreated = {
      id: 'uuid-1',
      nome: 'teste',
      descricao: null,
      criadoEm: new Date('2026-05-12T10:00:00Z'),
      atualizadoEm: new Date('2026-05-12T10:00:00Z'),
    };
    repoMock.create.mockResolvedValue(fakeCreated);

    const result = await templateService.create({ nome: 'teste' });

    expect(repoMock.create).toHaveBeenCalledWith({ nome: 'teste' });
    expect(result).toEqual(fakeCreated);
  });

  it('findById retorna entidade quando existe', async () => {
    const fake = {
      id: 'uuid-2',
      nome: 'X',
      descricao: 'Y',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    repoMock.findById.mockResolvedValue(fake);

    const result = await templateService.findById('uuid-2');

    expect(repoMock.findById).toHaveBeenCalledWith('uuid-2');
    expect(result).toEqual(fake);
  });

  it('findById lança NotFoundError quando repo retorna null', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(templateService.findById('inexistente')).rejects.toThrow(NotFoundError);
  });

  it('list pagina corretamente', async () => {
    repoMock.list.mockResolvedValue({
      rows: [
        {
          id: '1', nome: 'a', descricao: null,
          criadoEm: new Date(), atualizadoEm: new Date(),
        },
        {
          id: '2', nome: 'b', descricao: null,
          criadoEm: new Date(), atualizadoEm: new Date(),
        },
      ],
      total: 5,
    });

    const result = await templateService.list({ pagina: 1, limite: 2 });

    expect(result.dados.length).toBe(2);
    expect(result.total).toBe(5);
    expect(result.pagina).toBe(1);
    expect(result.limite).toBe(2);
    expect(result.totalPaginas).toBe(3);
  });

  it('update lança NotFoundError se repository retorna null', async () => {
    repoMock.update.mockResolvedValue(null);

    await expect(templateService.update('inexistente', { nome: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('remove lança NotFoundError se nada foi removido', async () => {
    repoMock.remove.mockResolvedValue(false);

    await expect(templateService.remove('inexistente')).rejects.toThrow(NotFoundError);
  });
});
