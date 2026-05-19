/**
 * Testes adicionais do notificacaoService — create, dispatchTelegram, savePreferencia.
 */
import { notificacaoService } from '../notificacao.service';
import { notificacaoRepository } from '../notificacao.repository';
import { telegramService } from '@modules/telegram/telegram.service';
import type { Notificacao } from '../notificacao.dto';

jest.mock('../notificacao.repository');
jest.mock('@modules/telegram/telegram.service', () => ({
  telegramService: { sendNotification: jest.fn() },
}));
jest.mock('@config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('@config/env', () => ({
  env: {
    TELEGRAM_ENABLED: true,
    TELEGRAM_BOT_TOKEN: 'fake',
    TELEGRAM_WEBHOOK_SECRET: 'fake',
    JWT_SECRET: 'test-secret-test-secret-test-secret-test',
    NODE_ENV: 'test',
  },
}));

const repoMock = notificacaoRepository as jest.Mocked<typeof notificacaoRepository>;
const telegramMock = telegramService as jest.Mocked<typeof telegramService>;

import { pool } from '@config/database';
const poolMock = pool as jest.Mocked<typeof pool>;

const fakeNotif = (overrides: Partial<Notificacao> = {}): Notificacao => ({
  id: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'hugo@just.com.br',
  evento: 'demand_assigned',
  origem: 'infra',
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

describe('notificacaoService.create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria notificação e retorna resultado do repo', async () => {
    repoMock.create.mockResolvedValue(fakeNotif());
    repoMock.pruneByUser.mockResolvedValue(0);
    // dispatchTelegram — pool query retorna sem chat_id
    poolMock.query.mockResolvedValue({ rows: [{ telegram_chat_id: null }] } as never);
    repoMock.getPreferencia.mockResolvedValue(null);

    const result = await notificacaoService.create({
      usuarioEmail: 'hugo@just.com.br',
      evento: 'demand_assigned',
      origem: 'infra',
      titulo: 'Nova demanda',
    });

    expect(result.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(repoMock.create).toHaveBeenCalledTimes(1);
    expect(repoMock.pruneByUser).toHaveBeenCalledWith('hugo@just.com.br', 500);
  });

  it('não envia telegram quando chat_id é null', async () => {
    repoMock.create.mockResolvedValue(fakeNotif());
    repoMock.pruneByUser.mockResolvedValue(0);
    poolMock.query.mockResolvedValue({ rows: [{ telegram_chat_id: null }] } as never);
    repoMock.getPreferencia.mockResolvedValue(null);

    await notificacaoService.create({
      usuarioEmail: 'hugo@just.com.br',
      evento: 'demand_assigned',
      origem: 'infra',
      titulo: 'X',
    });

    // Aguarda micro-tasks (dispatchTelegram é fire-and-forget)
    await new Promise((r) => setTimeout(r, 10));

    expect(telegramMock.sendNotification).not.toHaveBeenCalled();
  });
});

describe('notificacaoService.dispatchTelegram', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envia notificação telegram quando chat_id existe e canal habilitado', async () => {
    poolMock.query.mockResolvedValueOnce({
      rows: [{ telegram_chat_id: '99999' }],
    } as never);
    repoMock.getPreferencia.mockResolvedValue({
      usuarioEmail: 'hugo@just.com.br',
      eventos: {},
      canais: { inbox: true, browserPush: false, email: false, telegram: true },
      slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
    });
    telegramMock.sendNotification.mockResolvedValue(undefined);

    await notificacaoService.dispatchTelegram({
      usuarioEmail: 'hugo@just.com.br',
      evento: 'demand_assigned',
      origem: 'infra',
      titulo: 'Atribuida',
      ator: 'cliente@empresa.com',
      demandaId: 'demanda-id-1',
    });

    expect(telegramMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: '99999' }),
    );
  });

  it('não envia quando canal telegram está desabilitado nas prefs', async () => {
    poolMock.query.mockResolvedValueOnce({
      rows: [{ telegram_chat_id: '99999' }],
    } as never);
    repoMock.getPreferencia.mockResolvedValue({
      usuarioEmail: 'hugo@just.com.br',
      eventos: {},
      canais: { inbox: true, browserPush: false, email: false, telegram: false },
      slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
    });

    await notificacaoService.dispatchTelegram({
      usuarioEmail: 'hugo@just.com.br',
      evento: 'demand_assigned',
      origem: 'infra',
      titulo: 'X',
    });

    expect(telegramMock.sendNotification).not.toHaveBeenCalled();
  });
});

describe('notificacaoService.savePreferencia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delega para repo.upsertPreferencia e retorna resultado', async () => {
    const pref = {
      usuarioEmail: 'hugo@just.com.br',
      eventos: { demand_assigned: true },
      canais: { inbox: true, browserPush: false, email: false, telegram: true },
      slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
    };
    repoMock.upsertPreferencia.mockResolvedValue(pref);

    const result = await notificacaoService.savePreferencia('hugo@just.com.br', {
      eventos: { demand_assigned: true },
      canais: { inbox: true, browserPush: false, email: false },
      slaReminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
    });

    expect(result.usuarioEmail).toBe('hugo@just.com.br');
    expect(repoMock.upsertPreferencia).toHaveBeenCalledWith(
      'hugo@just.com.br',
      expect.any(Object),
    );
  });
});
