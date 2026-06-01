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
  solicitanteNome: 'Operador',
  solicitanteAvatar: null,
  responsavelNome: 'Operador Infra',
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
  nome: 'Operador Infra',
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
    const created = fake({ solicitanteNome: 'Operador' });
    repoMock.createInfra.mockResolvedValue(created);
    await demandaService.createInfra(
      {
        titulo: 'Nova',
        prioridade: 'p3',
        infraKind: 'sql',
        responsavelNome: 'Operador Infra',
        tags: [],
      },
      { nome: 'Operador', email: 'h@just.com.br', perfil: 'user' },
    );
    expect(repoMock.createInfra).toHaveBeenCalledWith(expect.objectContaining({
      solicitante: { nome: 'Operador', avatar: null },
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

  it('soft delete: id da demanda é preservado (softDelete chamado com id original)', async () => {
    const d = fake({ id: '00000000-0000-4000-8000-000000000042' });
    repoMock.findById.mockResolvedValue(d);
    repoMock.softDelete.mockResolvedValue(true);
    await demandaService.remove(
      '00000000-0000-4000-8000-000000000042',
      { nome: 'M', email: 'm@just.com.br', perfil: 'master' },
    );
    expect(repoMock.softDelete).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000042');
  });

  it('list com filtro de status passa para o repository', async () => {
    repoMock.list.mockResolvedValue({ rows: [], total: 0 });
    await demandaService.list({ pagina: 1, limite: 10, status: 'aberta' });
    expect(repoMock.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'aberta' }));
  });

  it('list com filtro de busca passa para o repository', async () => {
    repoMock.list.mockResolvedValue({ rows: [], total: 0 });
    await demandaService.list({ pagina: 1, limite: 10, busca: 'sql' });
    expect(repoMock.list).toHaveBeenCalledWith(expect.objectContaining({ busca: 'sql' }));
  });

  it('list com filtro de responsavel passa para o repository', async () => {
    repoMock.list.mockResolvedValue({ rows: [], total: 0 });
    await demandaService.list({ pagina: 1, limite: 10, responsavel: 'Tiago' });
    expect(repoMock.list).toHaveBeenCalledWith(expect.objectContaining({ responsavel: 'Tiago' }));
  });

  it('totalPaginas nunca fica abaixo de 1 mesmo sem resultados', async () => {
    repoMock.list.mockResolvedValue({ rows: [], total: 0 });
    const result = await demandaService.list({ pagina: 1, limite: 10 });
    expect(result.totalPaginas).toBe(1);
  });

  it('update apenas com campos permitidos (nao toca campos nao enviados)', async () => {
    repoMock.findById.mockResolvedValue(fake());
    repoMock.update.mockResolvedValue(fake({ titulo: 'atualizado' }));
    // Enviamos apenas titulo — o service nao deve modificar outros campos
    await demandaService.update('id', { titulo: 'atualizado' }, actor);
    expect(repoMock.update).toHaveBeenCalledWith('id', expect.objectContaining({ titulo: 'atualizado' }));
    // Nao deve ter passado campos que nao estavam no input
    const callArg = repoMock.update.mock.calls[0]?.[1];
    expect(callArg).not.toHaveProperty('status');
    expect(callArg).not.toHaveProperty('solicitanteNome');
  });

  it('concluir com sucesso via responsavel', async () => {
    repoMock.findById.mockResolvedValue(fake({ status: 'em_andamento' }));
    repoMock.update.mockResolvedValue(fake({ status: 'concluida' }));
    const result = await demandaService.concluir('id', actor);
    expect(result.status).toBe('concluida');
    expect(repoMock.update).toHaveBeenCalledWith('id', { status: 'concluida' });
  });

  it('concluir via reaction (master pode concluir qualquer demanda)', async () => {
    repoMock.findById.mockResolvedValue(fake({ status: 'em_andamento', responsavelNome: 'Outro' }));
    repoMock.update.mockResolvedValue(fake({ status: 'concluida' }));
    const result = await demandaService.concluir(
      'id',
      { nome: 'Master', email: 'm@just.com.br', perfil: 'master' },
    );
    expect(result.status).toBe('concluida');
  });

  it('concluir bloqueia user que nao é responsavel', async () => {
    repoMock.findById.mockResolvedValue(fake({ responsavelNome: 'Outro' }));
    await expect(demandaService.concluir('id', actor)).rejects.toThrow(ForbiddenError);
  });

  it('findById retorna demanda quando existe', async () => {
    const d = fake({ id: '00000000-0000-4000-8000-000000000001' });
    repoMock.findById.mockResolvedValue(d);
    const result = await demandaService.findById('00000000-0000-4000-8000-000000000001');
    expect(result.id).toBe('00000000-0000-4000-8000-000000000001');
  });
});
