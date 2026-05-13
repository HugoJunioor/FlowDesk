import { notaService } from '../nota.service';
import { notaRepository } from '../nota.repository';
import { NotFoundError } from '@shared/domain/errors';
import type { Nota } from '../nota.dto';

jest.mock('../nota.repository');
const repoMock = notaRepository as jest.Mocked<typeof notaRepository>;

const fake = (overrides: Partial<Nota> = {}): Nota => ({
  id: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'hugo@just.com.br',
  titulo: 'Teste',
  conteudo: '',
  status: 'todo',
  tags: [],
  cor: null,
  ordem: 1,
  items: [],
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  ...overrides,
});

describe('notaService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listMine filtra pelo email do user', async () => {
    repoMock.listByUser.mockResolvedValue([fake()]);
    const result = await notaService.listMine('hugo@just.com.br');
    expect(result.length).toBe(1);
    expect(repoMock.listByUser).toHaveBeenCalledWith('hugo@just.com.br');
  });

  it('findOne retorna a nota quando eh do user', async () => {
    repoMock.findById.mockResolvedValue(fake());
    const result = await notaService.findOne('id', 'hugo@just.com.br');
    expect(result.titulo).toBe('Teste');
  });

  it('findOne mascara nota de outro user como NotFound', async () => {
    repoMock.findById.mockResolvedValue(fake({ usuarioEmail: 'outro@just.com.br' }));
    await expect(notaService.findOne('id', 'hugo@just.com.br')).rejects.toThrow(NotFoundError);
  });

  it('findOne retorna NotFound quando nao existe', async () => {
    repoMock.findById.mockResolvedValue(null);
    await expect(notaService.findOne('id', 'x@x.com')).rejects.toThrow(NotFoundError);
  });

  it('update valida ownership antes de aplicar', async () => {
    repoMock.findById.mockResolvedValue(fake({ usuarioEmail: 'outro@just.com.br' }));
    await expect(
      notaService.update('id', 'hugo@just.com.br', { titulo: 'novo' }),
    ).rejects.toThrow(NotFoundError);
    expect(repoMock.update).not.toHaveBeenCalled();
  });

  it('update OK quando dono', async () => {
    repoMock.findById.mockResolvedValue(fake());
    repoMock.update.mockResolvedValue(fake({ titulo: 'novo' }));
    const result = await notaService.update('id', 'hugo@just.com.br', { titulo: 'novo' });
    expect(result.titulo).toBe('novo');
  });

  it('remove valida ownership', async () => {
    repoMock.findById.mockResolvedValue(fake({ usuarioEmail: 'outro@just.com.br' }));
    await expect(notaService.remove('id', 'hugo@just.com.br')).rejects.toThrow(NotFoundError);
    expect(repoMock.softDelete).not.toHaveBeenCalled();
  });

  it('remove OK quando dono', async () => {
    repoMock.findById.mockResolvedValue(fake());
    repoMock.softDelete.mockResolvedValue(true);
    await expect(notaService.remove('id', 'hugo@just.com.br')).resolves.toBeUndefined();
  });

  it('toggleChecklistItem atualiza apenas o item correto', async () => {
    const items = [
      { id: 'a', texto: 'A', feito: false, ordem: 0 },
      { id: 'b', texto: 'B', feito: false, ordem: 1 },
    ];
    repoMock.findById.mockResolvedValue(fake({ items }));
    repoMock.update.mockResolvedValue(fake({
      items: [
        { id: 'a', texto: 'A', feito: false, ordem: 0 },
        { id: 'b', texto: 'B', feito: true, ordem: 1 },
      ],
    }));
    const result = await notaService.toggleChecklistItem('nota-id', 'b', 'hugo@just.com.br', true);
    expect(result.items.find((i) => i.id === 'b')?.feito).toBe(true);
  });
});
