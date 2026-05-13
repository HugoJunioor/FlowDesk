import { auditoriaService } from '../auditoria.service';
import { auditoriaRepository } from '../auditoria.repository';
import type { AuditoriaEntry } from '../auditoria.dto';

jest.mock('../auditoria.repository');
const repoMock = auditoriaRepository as jest.Mocked<typeof auditoriaRepository>;

const fake = (overrides: Partial<AuditoriaEntry> = {}): AuditoriaEntry => ({
  id: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'hugo@just.com.br',
  recurso: 'nota',
  recursoId: 'nota-id',
  acao: 'create',
  payloadAntes: null,
  payloadDepois: { titulo: 'X' },
  ip: '192.168.1.1',
  userAgent: 'Mozilla/Test',
  requestId: 'req-1',
  criadoEm: new Date(),
  ...overrides,
});

describe('auditoriaService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list retorna paginacao calculada', async () => {
    repoMock.list.mockResolvedValue({ rows: [fake()], total: 75 });
    const result = await auditoriaService.list({ pagina: 1, limite: 25 });
    expect(result.dados.length).toBe(1);
    expect(result.total).toBe(75);
    expect(result.totalPaginas).toBe(3);
  });

  it('list aceita filtros opcionais', async () => {
    repoMock.list.mockResolvedValue({ rows: [], total: 0 });
    await auditoriaService.list({
      pagina: 1,
      limite: 50,
      recurso: 'auth',
      acao: 'login',
      usuarioEmail: 'hugo@just.com.br',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.000Z',
    });
    expect(repoMock.list).toHaveBeenCalledWith(expect.objectContaining({
      recurso: 'auth',
      acao: 'login',
      usuarioEmail: 'hugo@just.com.br',
    }));
  });

  it('totalPaginas eh sempre >= 1', async () => {
    repoMock.list.mockResolvedValue({ rows: [], total: 0 });
    const result = await auditoriaService.list({ pagina: 1, limite: 10 });
    expect(result.totalPaginas).toBe(1);
  });
});
