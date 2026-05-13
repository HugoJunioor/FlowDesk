import { notificacaoService } from '../notificacao.service';
import { notificacaoRepository } from '../notificacao.repository';
import { NotFoundError } from '@shared/domain/errors';
import type { Notificacao, Preferencia } from '../notificacao.dto';

jest.mock('../notificacao.repository');

const repoMock = notificacaoRepository as jest.Mocked<typeof notificacaoRepository>;

const fake = (overrides: Partial<Notificacao> = {}): Notificacao => ({
  id: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'hugo@just.com.br',
  evento: 'demand_assigned',
  origem: 'slack',
  demandaId: null,
  titulo: 'Nova demanda',
  mensagem: null,
  ator: null,
  lida: false,
  lidaEm: null,
  enviadaPor: null,
  criadoEm: new Date(),
  ...overrides,
});

describe('notificacaoService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listMine retorna apenas notificacoes do usuario', async () => {
    repoMock.listByUser.mockResolvedValue([fake(), fake({ id: 'x' })]);
    const result = await notificacaoService.listMine('hugo@just.com.br');
    expect(result.length).toBe(2);
    expect(repoMock.listByUser).toHaveBeenCalledWith('hugo@just.com.br', 500);
  });

  it('markRead valida ownership antes de atualizar', async () => {
    const own = fake();
    repoMock.listByUser.mockResolvedValue([own]);
    repoMock.markRead.mockResolvedValue({ ...own, lida: true, lidaEm: new Date() });

    const result = await notificacaoService.markRead(own.id, 'hugo@just.com.br', true);
    expect(result.lida).toBe(true);
  });

  it('markRead lança NotFound se notificacao nao eh do user', async () => {
    repoMock.listByUser.mockResolvedValue([fake({ id: 'a' })]);
    await expect(
      notificacaoService.markRead('outro-id', 'hugo@just.com.br', true),
    ).rejects.toThrow(NotFoundError);
  });

  it('markAllRead retorna count', async () => {
    repoMock.markAllReadByUser.mockResolvedValue(3);
    const result = await notificacaoService.markAllRead('hugo@just.com.br');
    expect(result.count).toBe(3);
  });

  it('getPreferencia retorna defaults quando nao existe', async () => {
    repoMock.getPreferencia.mockResolvedValue(null);
    const result = await notificacaoService.getPreferencia('novo@just.com.br');
    expect(result.usuarioEmail).toBe('novo@just.com.br');
    expect(result.canais.inbox).toBe(true);
    expect(result.canais.browserPush).toBe(false);
    expect(result.slaReminders.p1Hours).toBe(1);
  });

  it('getPreferencia retorna stored quando existe', async () => {
    const stored: Preferencia = {
      usuarioEmail: 'hugo@just.com.br',
      eventos: { demand_assigned: false },
      canais: { inbox: true, browserPush: true, email: false },
      slaReminders: { p1Hours: 2, p2Hours: 4, p3Hours: 8 },
    };
    repoMock.getPreferencia.mockResolvedValue(stored);
    const result = await notificacaoService.getPreferencia('hugo@just.com.br');
    expect(result).toEqual(stored);
  });
});
