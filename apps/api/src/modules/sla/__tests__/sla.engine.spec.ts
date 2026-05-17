/**
 * Testes do SLA engine.
 *
 * Mockamos pool.query para controlar quais demandas são retornadas
 * e verificar quais notificações seriam criadas (INSERT).
 * Também mockamos getBusinessMinutesBetween para isolar a lógica do engine.
 */
import { runSlaReminderCycle } from '../sla.engine';

// Mock do pool antes de qualquer import que use @config/database
jest.mock('@config/database', () => ({
  pool: { query: jest.fn() },
}));

// Mock do business-hours para controlar minutos restantes
jest.mock('@shared/business-hours/business-hours', () => ({
  getBusinessMinutesBetween: jest.fn(),
}));

import { pool } from '@config/database';
import { getBusinessMinutesBetween } from '@shared/business-hours/business-hours';

const poolMock = pool as jest.Mocked<typeof pool>;
const getMinutesMock = getBusinessMinutesBetween as jest.MockedFunction<typeof getBusinessMinutesBetween>;

const DEMANDA_ID = '00000000-0000-4000-8000-000000000001';

function makeDemanda(overrides: Partial<{
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
  origem: string;
  due_date: Date;
  responsavel_nome: string | null;
  solicitante_nome: string | null;
}> = {}) {
  return {
    id: DEMANDA_ID,
    titulo: 'Demanda SLA',
    prioridade: 'p2',
    status: 'aberta',
    origem: 'internal',
    due_date: new Date(Date.now() + 3600000),
    responsavel_nome: 'Tiago Silva',
    solicitante_nome: null,
    ...overrides,
  };
}

function setupPoolMocks({
  demandas = [makeDemanda()],
  users = [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
  prefs = [] as Array<{
    usuario_email: string;
    eventos: Record<string, boolean>;
    sla_reminders: { p1Hours: number; p2Hours: number; p3Hours: number };
  }>,
  alreadyNotified = false,
}: {
  demandas?: ReturnType<typeof makeDemanda>[];
  users?: Array<{ email: string; nome: string }>;
  prefs?: Array<{
    usuario_email: string;
    eventos: Record<string, boolean>;
    sla_reminders: { p1Hours: number; p2Hours: number; p3Hours: number };
  }>;
  alreadyNotified?: boolean;
} = {}) {
  let callCount = 0;
  poolMock.query.mockImplementation(async (sql: string) => {
    const s = sql as string;
    // 1a query: demandas
    if (s.includes('tb_demanda')) {
      return { rows: demandas, rowCount: demandas.length } as any;
    }
    // 2a query: usuários
    if (s.includes('tb_usuario')) {
      return { rows: users, rowCount: users.length } as any;
    }
    // 3a query: preferências
    if (s.includes('tb_preferencia_notificacao') && !s.includes('INSERT')) {
      return { rows: prefs, rowCount: prefs.length } as any;
    }
    // Query de exists (anti-spam)
    if (s.includes('EXISTS')) {
      return { rows: [{ exists: alreadyNotified }] } as any;
    }
    // INSERT notificacao
    if (s.includes('INSERT INTO tb_notificacao')) {
      return { rows: [], rowCount: 1 } as any;
    }
    return { rows: [], rowCount: 0 } as any;
  });
}

describe('runSlaReminderCycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 0 notificações quando não há demandas', async () => {
    setupPoolMocks({ demandas: [] });
    getMinutesMock.mockReturnValue(120);

    const result = await runSlaReminderCycle();
    expect(result.varridas).toBe(0);
    expect(result.dueSoonCriadas).toBe(0);
    expect(result.overdueCriadas).toBe(0);
  });

  it('cria demand_due_soon quando dentro do threshold de p2 (2h = 120 min)', async () => {
    setupPoolMocks({
      demandas: [makeDemanda({ prioridade: 'p2' })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [{
        usuario_email: 'tiago@just.com.br',
        eventos: { demand_due_soon: true },
        sla_reminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      }],
      alreadyNotified: false,
    });
    // 60 minutos restantes — menos que 2h (120 min) → dentro do threshold
    getMinutesMock.mockReturnValue(60);

    const result = await runSlaReminderCycle();
    expect(result.dueSoonCriadas).toBe(1);
    expect(result.overdueCriadas).toBe(0);
  });

  it('NÃO cria due_soon quando fora do threshold (minsToDue > threshold)', async () => {
    setupPoolMocks({
      demandas: [makeDemanda({ prioridade: 'p2' })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [{
        usuario_email: 'tiago@just.com.br',
        eventos: { demand_due_soon: true },
        sla_reminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      }],
    });
    // 300 minutos restantes — mais que 2h (120 min) → fora do threshold
    getMinutesMock.mockReturnValue(300);

    const result = await runSlaReminderCycle();
    expect(result.dueSoonCriadas).toBe(0);
  });

  it('cria demand_overdue quando minsToDue < 0', async () => {
    setupPoolMocks({
      demandas: [makeDemanda({ prioridade: 'p1' })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [{
        usuario_email: 'tiago@just.com.br',
        eventos: { demand_overdue: true },
        sla_reminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      }],
      alreadyNotified: false,
    });
    // Negativo = SLA estourado
    getMinutesMock.mockReturnValue(-30);

    const result = await runSlaReminderCycle();
    expect(result.overdueCriadas).toBe(1);
    expect(result.dueSoonCriadas).toBe(0);
  });

  it('anti-spam: não cria notificação se já foi notificado nas últimas 24h', async () => {
    setupPoolMocks({
      demandas: [makeDemanda({ prioridade: 'p1' })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [{
        usuario_email: 'tiago@just.com.br',
        eventos: { demand_overdue: true, demand_due_soon: true },
        sla_reminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      }],
      alreadyNotified: true, // já notificado
    });
    getMinutesMock.mockReturnValue(-30);

    const result = await runSlaReminderCycle();
    expect(result.overdueCriadas).toBe(0);
  });

  it('respeita preferência demand_overdue=false: não cria overdue', async () => {
    setupPoolMocks({
      demandas: [makeDemanda({ prioridade: 'p1' })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [{
        usuario_email: 'tiago@just.com.br',
        eventos: { demand_overdue: false }, // usuário desativou
        sla_reminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      }],
    });
    getMinutesMock.mockReturnValue(-30);

    const result = await runSlaReminderCycle();
    expect(result.overdueCriadas).toBe(0);
  });

  it('respeita preferência demand_due_soon=false: não cria due_soon', async () => {
    setupPoolMocks({
      demandas: [makeDemanda({ prioridade: 'p2' })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [{
        usuario_email: 'tiago@just.com.br',
        eventos: { demand_due_soon: false },
        sla_reminders: { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      }],
    });
    getMinutesMock.mockReturnValue(30); // dentro do threshold

    const result = await runSlaReminderCycle();
    expect(result.dueSoonCriadas).toBe(0);
  });

  it('ignora demanda sem responsavel e sem solicitante na equipe', async () => {
    setupPoolMocks({
      demandas: [makeDemanda({
        responsavel_nome: null,
        solicitante_nome: null, // nenhum match no mapa de users
      })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
    });
    getMinutesMock.mockReturnValue(30);

    const result = await runSlaReminderCycle();
    expect(result.varridas).toBe(1);
    expect(result.dueSoonCriadas).toBe(0);
  });

  it('usa prefs default quando user não tem preferência configurada', async () => {
    // Prefs vazio — engine usa defaults: p1=1h, p2=2h, p3=4h
    setupPoolMocks({
      demandas: [makeDemanda({ prioridade: 'p2' })],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [], // sem prefs — usa defaults
      alreadyNotified: false,
    });
    // 60 min restantes < 120 min (2h default p2)
    getMinutesMock.mockReturnValue(60);

    const result = await runSlaReminderCycle();
    expect(result.dueSoonCriadas).toBe(1);
  });

  it('retorna varridas corretamente com múltiplas demandas', async () => {
    setupPoolMocks({
      demandas: [
        makeDemanda({ id: 'id-1', responsavel_nome: 'Tiago Silva' }),
        makeDemanda({ id: 'id-2', responsavel_nome: 'Tiago Silva' }),
        makeDemanda({ id: 'id-3', responsavel_nome: 'Tiago Silva' }),
      ],
      users: [{ email: 'tiago@just.com.br', nome: 'Tiago Silva' }],
      prefs: [],
      alreadyNotified: true, // não cria nenhuma
    });
    getMinutesMock.mockReturnValue(-10); // todas overdue

    const result = await runSlaReminderCycle();
    expect(result.varridas).toBe(3);
  });
});
