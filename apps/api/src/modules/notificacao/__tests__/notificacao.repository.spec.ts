/**
 * Testes do notificacaoRepository — pool mockado.
 */
import { pool } from '@config/database';
import { notificacaoRepository } from '../notificacao.repository';

jest.mock('@config/database', () => ({
  pool: { query: jest.fn() },
}));

const poolMock = pool as jest.Mocked<typeof pool>;

const NOTIF_ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  usuario_email: 'hugo@just.com.br',
  evento: 'demand_assigned',
  origem: 'infra',
  demanda_id: null,
  titulo: 'Teste',
  mensagem: null,
  ator: null,
  lida: false,
  lida_em: null,
  enviada_por: null,
  criado_em: new Date(),
};

const PREF_ROW = {
  usuario_email: 'hugo@just.com.br',
  eventos: { demand_assigned: true },
  canais: { inbox: true, browserPush: false, email: false, telegram: true },
  sla_reminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
  daily_reminder: true,
  atualizado_em: new Date(),
};

describe('notificacaoRepository.listByUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna lista mapeada', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [NOTIF_ROW] } as never);

    const result = await notificacaoRepository.listByUser('hugo@just.com.br');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(NOTIF_ROW.id);
    expect(result[0]?.usuarioEmail).toBe('hugo@just.com.br');
    expect(result[0]?.lida).toBe(false);
  });

  it('retorna lista vazia', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await notificacaoRepository.listByUser('vazio@just.com.br');

    expect(result).toHaveLength(0);
  });

  it('usa limit quando fornecido', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    await notificacaoRepository.listByUser('hugo@just.com.br', 50);

    expect(poolMock.query).toHaveBeenCalledWith(
      expect.any(String),
      ['hugo@just.com.br', 50],
    );
  });
});

describe('notificacaoRepository.create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria e retorna notificação mapeada', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [NOTIF_ROW] } as never);

    const result = await notificacaoRepository.create({
      usuarioEmail: 'hugo@just.com.br',
      evento: 'demand_assigned',
      origem: 'infra',
      titulo: 'Teste',
    });

    expect(result.id).toBe(NOTIF_ROW.id);
  });

  it('lança Error quando INSERT não retorna linha', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      notificacaoRepository.create({
        usuarioEmail: 'x@x.com',
        evento: 'demand_assigned',
        origem: 'infra',
        titulo: 'X',
      }),
    ).rejects.toThrow('INSERT em tb_notificacao não retornou linha');
  });
});

describe('notificacaoRepository.markRead', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna notificação atualizada', async () => {
    const lida_em = new Date();
    poolMock.query.mockResolvedValueOnce({
      rows: [{ ...NOTIF_ROW, lida: true, lida_em }],
    } as never);

    const result = await notificacaoRepository.markRead(NOTIF_ROW.id, true);

    expect(result?.lida).toBe(true);
    expect(result?.lidaEm).toBe(lida_em);
  });

  it('retorna null quando notificação não existe', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await notificacaoRepository.markRead('inexistente', true);

    expect(result).toBeNull();
  });
});

describe('notificacaoRepository.markAllReadByUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna count de linhas atualizadas', async () => {
    poolMock.query.mockResolvedValueOnce({ rowCount: 7 } as never);

    const count = await notificacaoRepository.markAllReadByUser('hugo@just.com.br');

    expect(count).toBe(7);
  });

  it('retorna 0 quando nenhuma notificação não lida', async () => {
    poolMock.query.mockResolvedValueOnce({ rowCount: 0 } as never);

    const count = await notificacaoRepository.markAllReadByUser('vazio@just.com.br');

    expect(count).toBe(0);
  });
});

describe('notificacaoRepository.pruneByUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna count de linhas deletadas', async () => {
    poolMock.query.mockResolvedValueOnce({ rowCount: 3 } as never);

    const count = await notificacaoRepository.pruneByUser('hugo@just.com.br', 500);

    expect(count).toBe(3);
  });
});

describe('notificacaoRepository.getPreferencia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna preferência mapeada quando existe', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [PREF_ROW] } as never);

    const result = await notificacaoRepository.getPreferencia('hugo@just.com.br');

    expect(result?.usuarioEmail).toBe('hugo@just.com.br');
    expect(result?.canais.telegram).toBe(true);
    expect(result?.slaReminders.p1Hours).toBe(1);
  });

  it('retorna null quando não existe', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await notificacaoRepository.getPreferencia('novo@just.com.br');

    expect(result).toBeNull();
  });
});

describe('notificacaoRepository.upsertPreferencia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna preferência após upsert', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [PREF_ROW] } as never);

    const result = await notificacaoRepository.upsertPreferencia('hugo@just.com.br', {
      eventos: { demand_assigned: true },
      canais: { inbox: true, browserPush: false, email: false },
      slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
    });

    expect(result.usuarioEmail).toBe('hugo@just.com.br');
  });

  it('lança Error quando UPSERT não retorna linha', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      notificacaoRepository.upsertPreferencia('x@x.com', {
        eventos: {},
        canais: { inbox: true, browserPush: false, email: false },
        slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      }),
    ).rejects.toThrow('UPSERT em tb_preferencia_notificacao falhou');
  });
});
