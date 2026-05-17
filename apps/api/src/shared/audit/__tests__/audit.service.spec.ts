import { auditService } from '../audit.service';
import { auditRepository } from '../audit.repository';

jest.mock('../audit.repository');
const repoMock = auditRepository as jest.Mocked<typeof auditRepository>;

describe('auditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repoMock.log.mockResolvedValue(undefined);
  });

  it('chama repository com dados basicos', async () => {
    auditService.log({
      usuarioEmail: 'hugo@just.com.br',
      recurso: 'nota',
      recursoId: 'nota-id',
      acao: 'create',
    });
    // Fire-and-forget: aguarda promise interna
    await new Promise((r) => setImmediate(r));
    expect(repoMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioEmail: 'hugo@just.com.br',
        recurso: 'nota',
        acao: 'create',
      }),
    );
  });

  it('sanitiza campos sensiveis em payload', async () => {
    auditService.log({
      usuarioEmail: null,
      recurso: 'auth',
      acao: 'login',
      payloadDepois: {
        usuario: 'hugo',
        senha: 'secreta-123',
        novaSenha: 'tambem-secreta',
        token: 'jwt-abc',
        nested: { passwordHash: 'pbkdf2$...' },
      },
    });
    await new Promise((r) => setImmediate(r));
    const call = repoMock.log.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    const payload = call!.payloadDepois as Record<string, unknown>;
    expect(payload.usuario).toBe('hugo');
    expect(payload.senha).toBe('[REDACTED]');
    expect(payload.novaSenha).toBe('[REDACTED]');
    expect(payload.token).toBe('[REDACTED]');
    expect((payload.nested as Record<string, unknown>).passwordHash).toBe('[REDACTED]');
  });

  it('nao quebra se repository falhar', async () => {
    repoMock.log.mockRejectedValueOnce(new Error('db down'));
    expect(() =>
      auditService.log({ usuarioEmail: 'x', recurso: 'a', acao: 'b' }),
    ).not.toThrow();
    await new Promise((r) => setImmediate(r));
    // repository foi chamado, mas erro foi engolido
    expect(repoMock.log).toHaveBeenCalled();
  });

  it('sanitiza campos authorization, accessToken e refreshToken', async () => {
    auditService.log({
      usuarioEmail: null,
      recurso: 'auth',
      acao: 'login',
      payloadDepois: {
        authorization: 'Bearer jwt-abc',
        accessToken: 'jwt-xyz',
        refreshToken: 'refresh-xyz',
        usuario: 'hugo',
      },
    });
    await new Promise((r) => setImmediate(r));
    const call = repoMock.log.mock.calls[0]?.[0];
    const payload = call!.payloadDepois as Record<string, unknown>;
    expect(payload.authorization).toBe('[REDACTED]');
    expect(payload.accessToken).toBe('[REDACTED]');
    expect(payload.refreshToken).toBe('[REDACTED]');
    expect(payload.usuario).toBe('hugo');
  });

  it('sanitiza arrays que contem objetos sensiveis', async () => {
    auditService.log({
      usuarioEmail: null,
      recurso: 'test',
      acao: 'test',
      payloadDepois: {
        items: [
          { nome: 'x', senha: 'secreta' },
          { nome: 'y', valor: 42 },
        ],
      },
    });
    await new Promise((r) => setImmediate(r));
    const call = repoMock.log.mock.calls[0]?.[0];
    const payload = call!.payloadDepois as Record<string, unknown>;
    const items = payload.items as Array<Record<string, unknown>>;
    expect(items[0]?.senha).toBe('[REDACTED]');
    expect(items[0]?.nome).toBe('x');
    expect(items[1]?.valor).toBe(42);
  });

  it('extrai contexto de req quando passado', async () => {
    const fakeReq = {
      ip: '192.168.1.10',
      id: 'req-123',
      user: { email: 'admin@just.com.br', id: 'u1', login: 'admin', perfil: 'master', status: 'active', primeiroAcesso: false, grupos: [], permissoes: [], nome: 'Admin' },
      header: (h: string) => h.toLowerCase() === 'user-agent' ? 'Mozilla/Test' : null,
    } as any;
    auditService.log({ req: fakeReq, recurso: 'demanda', acao: 'create' });
    await new Promise((r) => setImmediate(r));
    const call = repoMock.log.mock.calls[0]?.[0];
    expect(call?.usuarioEmail).toBe('admin@just.com.br');
    expect(call?.ip).toBe('192.168.1.10');
    expect(call?.userAgent).toBe('Mozilla/Test');
    expect(call?.requestId).toBe('req-123');
  });
});
