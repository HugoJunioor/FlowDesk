/**
 * Testes do notaRepository — mockando pool do banco.
 */
import { pool } from '@config/database';
import { notaRepository } from '../nota.repository';

jest.mock('@config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const poolMock = pool as jest.Mocked<typeof pool>;
const connectMock = pool.connect as jest.Mock;

// Helper para criar um client mock de transação
function makeClient(rows: Record<string, unknown>[][] = []) {
  let callIdx = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      const result = rows[callIdx] ?? [];
      callIdx++;
      return Promise.resolve({ rows: result, rowCount: result.length });
    }),
    release: jest.fn(),
  };
}

const NOTA_ROW = {
  id: 'nota-id-001',
  usuario_email: 'hugo@just.com.br',
  titulo: 'Titulo',
  conteudo: 'Conteudo',
  status: 'todo',
  tags: [],
  cor: null,
  ordem: '1000000',
  criado_em: new Date(),
  atualizado_em: new Date(),
  excluido_em: null,
};

const ITEM_ROW = {
  id: 'item-id-001',
  nota_id: 'nota-id-001',
  texto: 'Item A',
  feito: false,
  ordem: 0,
  criado_em: new Date(),
  atualizado_em: new Date(),
};

describe('notaRepository.listByUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna lista mapeada corretamente', async () => {
    // 1a query: SELECT notas; 2a query: SELECT items
    poolMock.query
      .mockResolvedValueOnce({ rows: [NOTA_ROW] } as never)
      .mockResolvedValueOnce({ rows: [ITEM_ROW] } as never);

    const result = await notaRepository.listByUser('hugo@just.com.br');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('nota-id-001');
    expect(result[0]?.items).toHaveLength(1);
    expect(result[0]?.items[0]?.texto).toBe('Item A');
  });

  it('retorna lista vazia quando não há notas', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await notaRepository.listByUser('vazio@just.com.br');

    expect(result).toHaveLength(0);
    // Não faz segunda query quando não há IDs
    expect(poolMock.query).toHaveBeenCalledTimes(1);
  });
});

describe('notaRepository.findById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna null quando nota não existe', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await notaRepository.findById('inexistente');

    expect(result).toBeNull();
  });

  it('retorna nota mapeada com items', async () => {
    poolMock.query
      .mockResolvedValueOnce({ rows: [NOTA_ROW] } as never)
      .mockResolvedValueOnce({ rows: [ITEM_ROW] } as never);

    const result = await notaRepository.findById('nota-id-001');

    expect(result?.id).toBe('nota-id-001');
    expect(result?.items).toHaveLength(1);
  });
});

describe('notaRepository.create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria nota sem items', async () => {
    const client = makeClient([
      [], // BEGIN
      [NOTA_ROW], // INSERT nota
      [], // COMMIT
    ]);
    connectMock.mockResolvedValue(client);

    const result = await notaRepository.create('hugo@just.com.br', {
      titulo: 'Nova',
      conteudo: '',
      status: 'todo',
      tags: [],
      items: [],
    });

    expect(result.id).toBe('nota-id-001');
    expect(result.items).toHaveLength(0);
    expect(client.release).toHaveBeenCalled();
  });

  it('cria nota com items e faz INSERT por item', async () => {
    const client = makeClient([
      [], // BEGIN
      [NOTA_ROW], // INSERT nota
      [ITEM_ROW], // INSERT item 1
      [], // COMMIT
    ]);
    connectMock.mockResolvedValue(client);

    const result = await notaRepository.create('hugo@just.com.br', {
      titulo: 'Nova',
      conteudo: '',
      status: 'todo',
      tags: [],
      items: [{ texto: 'Item A', feito: false }],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.texto).toBe('Item A');
  });

  it('faz ROLLBACK em caso de erro e lança a exceção', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')), // INSERT falha
      release: jest.fn(),
    };
    connectMock.mockResolvedValue(client);

    await expect(
      notaRepository.create('hugo@just.com.br', {
        titulo: 'X',
        conteudo: '',
        status: 'todo',
        tags: [],
        items: [],
      }),
    ).rejects.toThrow('DB error');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('notaRepository.softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna true quando nota foi deletada', async () => {
    poolMock.query.mockResolvedValueOnce({ rowCount: 1 } as never);

    const result = await notaRepository.softDelete('nota-id-001');

    expect(result).toBe(true);
  });

  it('retorna false quando nota não foi encontrada', async () => {
    poolMock.query.mockResolvedValueOnce({ rowCount: 0 } as never);

    const result = await notaRepository.softDelete('inexistente');

    expect(result).toBe(false);
  });
});

describe('notaRepository.update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna null quando nota não existe', async () => {
    const client = makeClient([
      [], // BEGIN
      [], // UPDATE (sem rows retornadas — nota não existe)
    ]);
    connectMock.mockResolvedValue(client);

    const result = await notaRepository.update('inexistente', { titulo: 'X' });

    expect(result).toBeNull();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('atualiza nota e mantém items existentes quando items não enviado', async () => {
    const updatedRow = { ...NOTA_ROW, titulo: 'Atualizado' };
    const client = makeClient([
      [], // BEGIN
      [updatedRow], // UPDATE nota
      [], // COMMIT
    ]);
    connectMock.mockResolvedValue(client);

    // fetchItems usa pool.query diretamente (fora do client de transação)
    poolMock.query.mockResolvedValueOnce({ rows: [ITEM_ROW] } as never);

    const result = await notaRepository.update('nota-id-001', { titulo: 'Atualizado' });

    expect(result?.titulo).toBe('Atualizado');
    expect(result?.items).toHaveLength(1);
  });

  it('substitui items quando items é enviado', async () => {
    const client = makeClient([
      [], // BEGIN
      [NOTA_ROW], // UPDATE nota
      [], // DELETE items
      [ITEM_ROW], // INSERT item
      [], // COMMIT
    ]);
    connectMock.mockResolvedValue(client);

    const result = await notaRepository.update('nota-id-001', {
      items: [{ texto: 'Item A', feito: false }],
    });

    expect(result?.items).toHaveLength(1);
  });
});
