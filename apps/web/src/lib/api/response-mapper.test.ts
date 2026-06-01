import { describe, it, expect } from 'vitest';
import { unwrap, unwrapPaginated } from './response-mapper';

describe('unwrap', () => {
  it('extrai dados de envelope de sucesso', () => {
    const res = {
      data: { sucesso: true as const, dados: { id: '1', nome: 'Operador' } },
    } as Parameters<typeof unwrap>[0];
    expect(unwrap(res)).toEqual({ id: '1', nome: 'Operador' });
  });

  it('lança erro se envelope nao for sucesso', () => {
    const res = {
      data: { erro: true, mensagem: 'erro' },
    } as unknown as Parameters<typeof unwrap>[0];
    expect(() => unwrap(res)).toThrow();
  });

  it('lança erro se body for vazio', () => {
    const res = { data: null } as unknown as Parameters<typeof unwrap>[0];
    expect(() => unwrap(res)).toThrow();
  });
});

describe('unwrapPaginated', () => {
  it('retorna envelope completo de lista', () => {
    const res = {
      data: {
        sucesso: true as const,
        dados: [{ id: '1' }, { id: '2' }],
        total: 5,
        pagina: 1,
        limite: 10,
        totalPaginas: 1,
      },
    } as Parameters<typeof unwrapPaginated>[0];
    const out = unwrapPaginated(res);
    expect(out.dados.length).toBe(2);
    expect(out.total).toBe(5);
    expect(out.totalPaginas).toBe(1);
  });
});
