/**
 * Testes do usuariosRepository — pool mockado.
 */
import { pool } from '@config/database';
import { usuariosRepository } from '../usuarios.repository';

jest.mock('@config/database', () => ({
  pool: { query: jest.fn() },
}));

const poolMock = pool as jest.Mocked<typeof pool>;

const USUARIO_ROW = {
  id: 'user-id-001',
  login: 'hugo',
  email: 'hugo@just.com.br',
  nome: 'Hugo',
  perfil: 'user',
  status: 'active',
  senha_hash: '$2b$12$fake',
  primeiro_acesso: false,
  reset_senha_solicitado: false,
  avatar_url: null,
  criado_em: new Date(),
  atualizado_em: new Date(),
  excluido_em: null,
};

describe('usuariosRepository.findById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna usuário quando existe', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [USUARIO_ROW] } as never);

    const result = await usuariosRepository.findById('user-id-001');

    expect(result?.id).toBe('user-id-001');
    expect(result?.email).toBe('hugo@just.com.br');
  });

  it('retorna null quando usuário não existe', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await usuariosRepository.findById('inexistente');

    expect(result).toBeNull();
  });
});

describe('usuariosRepository.anonimizar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna id e anonimizadoEm quando bem sucedido', async () => {
    const agora = new Date();
    poolMock.query.mockResolvedValueOnce({
      rows: [{ id: 'user-id-001', excluido_em: agora }],
    } as never);

    const result = await usuariosRepository.anonimizar('user-id-001', {
      email: 'anonimo-uuid@deleted.local',
      nome: 'Usuário Anonimizado',
      login: 'anon_12345',
      senhaHash: '$2b$12$fakehash',
    });

    expect(result.id).toBe('user-id-001');
    expect(result.anonimizadoEm).toBe(agora);
  });

  it('lança Error quando UPDATE não retorna nenhuma linha', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      usuariosRepository.anonimizar('inexistente', {
        email: 'anonimo@deleted.local',
        nome: 'Usuário Anonimizado',
        login: 'anon_0',
        senhaHash: '$2b$12$x',
      }),
    ).rejects.toThrow('Usuário inexistente não encontrado ao anonimizar');
  });
});
