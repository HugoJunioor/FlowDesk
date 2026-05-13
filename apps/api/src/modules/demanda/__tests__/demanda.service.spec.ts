import { demandaService } from '../demanda.service';
import { demandaRepository } from '../demanda.repository';
import { NotFoundError, ForbiddenError, ConflictError } from '@shared/domain/errors';
import type { Demanda } from '../demanda.dto';

jest.mock('../demanda.repository');
const repoMock = demandaRepository as jest.Mocked<typeof demandaRepository>;

const fake = (overrides: Partial<Demanda> = {}): Demanda => ({
  id: '00000000-0000-4000-8000-000000000001',
  origem: 'internal',
  titulo: 'Demanda teste',
  descricao: null,
  prioridade: 'p3',
  status: 'aberta',
  tipoDemanda: null,
  workflow: null,
  produto: null,
  solicitanteNome: 'Hugo',
  solicitanteAvatar: null,
  responsavelNome: 'Tiago Silva',
  responsavelAvatar: null,
  infraKind: 'sql',
  infraQuery: null,
  infraDatabase: null,
  infraExternalLink: null,
  canalSlack: null,
  permalinkSlack: null,
  replies: 0,
  dueDate: null,
  concluidaEm: null,
  serviceStartedAt: null,
  hasTask: false,
  taskLink: null,
  tags: [],
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  ...overrides,
});

const actor = {
  nome: 'Tiago Silva',
  email: 'tiago@just.com.br',
  perfil: 'user' as const,
};

describe('demandaService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list retorna paginacao calculada', async () => {
    repoMock.list.mockResolvedValue({ rows: [fake()], total: 25 });
    const result = await demandaService.list({ pagina: 1, limite: 10 });
    expect(result.dados.length).toBe(1);
    expect(result.totalPaginas).toBe(3);
  });

  it('findById lança NotFound', async () => {
    repoMock.findById.mockResolvedValue(null);
    await expect(demandaService.findById('id')).rejects.toThrow(NotFoundError);
  });

  it('createInfra usa nome do actor como solicitante', async () => {
    const created = fake({ solicitanteNome: 'Hugo' });
    repoMock.createInfra.mockResolvedValue(created);
    await demandaService.createInfra(
      {
        titulo: 'Nova',
        prioridade: 'p3',
        infraKind: 'sql',
        responsavelNome: 'Tiago Silva',
        tags: [],
      },
      { nome: 'Hugo', email: 'h@just.com.br', perfil: 'user' },
    );
    expect(repoMock.createInfra).toHaveBeenCalledWith(expect.objectContaining({
      solicitante: { nome: 'Hugo', avatar: null },
    }));
  });

  it('update permite responsavel', async () => {
    repoMock.findById.mockResolvedValue(fake());
    repoMock.update.mockResolvedValue(fake({ titulo: 'novo' }));
    const result = await demandaService.update('id', { titulo: 'novo' }, actor);
    expect(result.titulo).toBe('novo');
  });

  it('update bloqueia user nao autorizado', async () => {
    repoMock.findById.mockResolvedValue(fake({
      solicitanteNome: 'Outro',
      responsavelNome: 'Outro',
    }));
    await expect(
      demandaService.update('id', { titulo: 'x' }, actor),
    ).rejects.toThrow(ForbiddenError);
  });

  it('master pode editar qualquer demanda', async () => {
    repoMock.findById.mockResolvedValue(fake({
      solicitanteNome: 'Outro',
      responsavelNome: 'Outro',
    }));
    repoMock.update.mockResolvedValue(fake({ titulo: 'mexido' }));
    await expect(
      demandaService.update(
        'id',
        { titulo: 'mexido' },
        { nome: 'Master', email: 'm@just.com.br', perfil: 'master' },
      ),
    ).resolves.toBeDefined();
  });

  it('atender exige status=aberta', async () => {
    repoMock.findById.mockResolvedValue(fake({ status: 'em_andamento' }));
    await expect(demandaService.atender('id', actor)).rejects.toThrow(ConflictError);
  });

  it('atender por responsavel funciona', async () => {
    repoMock.findById.mockResolvedValue(fake());
    repoMock.update.mockResolvedValue(fake({ status: 'em_andamento' }));
    const result = await demandaService.atender('id', actor);
    expect(result.status).toBe('em_andamento');
  });

  it('atender bloqueia user nao responsavel', async () => {
    repoMock.findById.mockResolvedValue(fake({ responsavelNome: 'Outro' }));
    await expect(demandaService.atender('id', actor)).rejects.toThrow(ForbiddenError);
  });

  it('concluir rejeita se ja concluida', async () => {
    repoMock.findById.mockResolvedValue(fake({ status: 'concluida' }));
    await expect(demandaService.concluir('id', actor)).rejects.toThrow(ConflictError);
  });

  it('remove exige master', async () => {
    repoMock.findById.mockResolvedValue(fake());
    await expect(demandaService.remove('id', actor)).rejects.toThrow(ForbiddenError);
  });

  it('remove OK para master', async () => {
    repoMock.findById.mockResolvedValue(fake());
    repoMock.softDelete.mockResolvedValue(true);
    await expect(
      demandaService.remove('id', { nome: 'M', email: 'm@just.com.br', perfil: 'master' }),
    ).resolves.toBeUndefined();
  });
});
