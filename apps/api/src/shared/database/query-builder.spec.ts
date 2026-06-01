/**
 * Testes do query-builder. Garante que SQL gerado é parametrizado
 * corretamente (anti SQL injection).
 */
import { buildInsert, buildUpdate, sanitizeSearch, paginate } from './query-builder';

describe('buildInsert', () => {
  it('gera SQL parametrizado básico', () => {
    const { sql, values } = buildInsert('tb_x', { nome: 'Operador', email: 'h@x' });
    expect(sql).toBe('INSERT INTO tb_x (nome, email) VALUES ($1, $2)');
    expect(values).toEqual(['Operador', 'h@x']);
  });

  it('inclui RETURNING quando solicitado', () => {
    const { sql } = buildInsert('tb_x', { a: 1 }, ['id', 'criado_em']);
    expect(sql).toContain('RETURNING id, criado_em');
  });

  it('ignora valores undefined', () => {
    const { sql, values } = buildInsert('tb_x', { a: 1, b: undefined, c: 3 });
    expect(sql).toBe('INSERT INTO tb_x (a, c) VALUES ($1, $2)');
    expect(values).toEqual([1, 3]);
  });

  it('lança erro pra payload vazio', () => {
    expect(() => buildInsert('tb_x', {})).toThrow();
    expect(() => buildInsert('tb_x', { a: undefined })).toThrow();
  });
});

describe('buildUpdate', () => {
  it('gera SET + WHERE parametrizados', () => {
    const { sql, values } = buildUpdate('tb_x', { nome: 'Operador' }, { id: 'uuid-1' });
    expect(sql).toBe('UPDATE tb_x SET nome = $1 WHERE id = $2');
    expect(values).toEqual(['Operador', 'uuid-1']);
  });

  it('incrementa placeholders corretamente com múltiplos SET + WHERE', () => {
    const { sql, values } = buildUpdate(
      'tb_x',
      { a: 1, b: 2 },
      { id: 'uuid-x', status: 'active' },
    );
    expect(sql).toBe('UPDATE tb_x SET a = $1, b = $2 WHERE id = $3 AND status = $4');
    expect(values).toEqual([1, 2, 'uuid-x', 'active']);
  });

  it('lança erro com WHERE vazio (proteção contra UPDATE sem condição)', () => {
    expect(() => buildUpdate('tb_x', { a: 1 }, {})).toThrow();
  });

  it('lança erro com SET vazio', () => {
    expect(() => buildUpdate('tb_x', {}, { id: 'x' })).toThrow();
  });
});

describe('sanitizeSearch', () => {
  it('envolve em wildcards', () => {
    expect(sanitizeSearch('hugo')).toBe('%hugo%');
  });

  it('escapa % e _ pra evitar injection', () => {
    expect(sanitizeSearch('50%_off')).toBe('%50\\%\\_off%');
    expect(sanitizeSearch('a\\b')).toBe('%a\\\\b%');
  });
});

describe('paginate', () => {
  it('calcula offset corretamente', () => {
    expect(paginate(1, 20)).toEqual({ limit: 20, offset: 0 });
    expect(paginate(2, 20)).toEqual({ limit: 20, offset: 20 });
    expect(paginate(5, 10)).toEqual({ limit: 10, offset: 40 });
  });

  it('clamps page a >= 1', () => {
    expect(paginate(0, 10)).toEqual({ limit: 10, offset: 0 });
    expect(paginate(-3, 10)).toEqual({ limit: 10, offset: 0 });
  });

  it('clamps perPage a [1, 100]', () => {
    expect(paginate(1, 200)).toEqual({ limit: 100, offset: 0 });
    expect(paginate(1, 0)).toEqual({ limit: 1, offset: 0 });
  });
});
