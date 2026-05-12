/**
 * Testes do service do _template. Smoke tests pra garantir que o
 * template compila e os fluxos basicos funcionam — quando alguem copiar
 * pra criar um modulo novo, ja sabe o formato esperado dos testes.
 */
import { templateService } from '../_template.service';
import { NotFoundError } from '@shared/domain/errors';

describe('templateService', () => {
  it('create + findById retorna o template criado', async () => {
    const created = await templateService.create({ nome: 'teste-1' });
    expect(created.id).toBeDefined();
    expect(created.nome).toBe('teste-1');
    const found = await templateService.findById(created.id);
    expect(found.id).toBe(created.id);
  });

  it('findById lança NotFoundError para id inexistente', async () => {
    await expect(
      templateService.findById('00000000-0000-4000-8000-000000000000'),
    ).rejects.toThrow(NotFoundError);
  });

  it('list pagina corretamente', async () => {
    for (let i = 0; i < 5; i++) {
      await templateService.create({ nome: `paginated-${i}` });
    }
    const res = await templateService.list({ pagina: 1, limite: 2 });
    expect(res.dados.length).toBeLessThanOrEqual(2);
    expect(res.pagina).toBe(1);
    expect(res.limite).toBe(2);
    expect(res.totalPaginas).toBeGreaterThanOrEqual(1);
  });
});
