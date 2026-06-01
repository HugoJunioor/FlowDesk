import { threadService } from '../thread.service';
import { threadRepository } from '../thread.repository';
import { demandaRepository } from '../demanda.repository';
import { NotFoundError } from '@shared/domain/errors';

jest.mock('../thread.repository');
jest.mock('../demanda.repository');

const threadMock = threadRepository as jest.Mocked<typeof threadRepository>;
const demandaMock = demandaRepository as jest.Mocked<typeof demandaRepository>;

const fakeDemanda = (): any => ({
  id: '00000000-0000-4000-8000-000000000001',
  origem: 'slack',
  titulo: 'X',
  descricao: null,
  prioridade: 'p3',
  status: 'aberta',
  responsavelNome: 'Operador',
  solicitanteNome: 'Cliente',
});

describe('threadService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list lança NotFound se demanda nao existe', async () => {
    demandaMock.findById.mockResolvedValue(null);
    await expect(threadService.list('id')).rejects.toThrow(NotFoundError);
  });

  it('list delega para o repository', async () => {
    demandaMock.findById.mockResolvedValue(fakeDemanda());
    threadMock.listByDemanda.mockResolvedValue([]);
    await threadService.list('demanda-id');
    expect(threadMock.listByDemanda).toHaveBeenCalledWith('demanda-id');
  });

  it('add lança NotFound se demanda nao existe', async () => {
    demandaMock.findById.mockResolvedValue(null);
    await expect(
      threadService.add('id', 'Operador', { texto: 'resp', ehMembroEquipe: true, temCheckReaction: false, temLoadingReaction: false }),
    ).rejects.toThrow(NotFoundError);
  });

  it('add chama repository com autor + input', async () => {
    demandaMock.findById.mockResolvedValue(fakeDemanda());
    threadMock.add.mockResolvedValue({
      id: 'r1',
      demandaId: 'd1',
      autor: 'Operador',
      texto: 'oi',
      timestampMsg: new Date(),
      ehMembroEquipe: true,
      temCheckReaction: false,
      temLoadingReaction: false,
      arquivos: null,
      criadoEm: new Date(),
    });

    await threadService.add('d1', 'Operador', {
      texto: 'oi',
      ehMembroEquipe: true,
      temCheckReaction: false,
      temLoadingReaction: false,
    });
    expect(threadMock.add).toHaveBeenCalledWith('d1', 'Operador', expect.any(Object));
  });

  it('updateClosure lança NotFound se demanda nao existe', async () => {
    demandaMock.findById.mockResolvedValue(null);
    await expect(
      threadService.updateClosure('id', { categoria: 'X' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('updateClosure delega ao repository', async () => {
    demandaMock.findById.mockResolvedValue(fakeDemanda());
    threadMock.updateClosure.mockResolvedValue({ categoria: 'Sitef' });

    const result = await threadService.updateClosure('id', { categoria: 'Sitef' });
    expect(result).toEqual({ categoria: 'Sitef' });
  });
});
