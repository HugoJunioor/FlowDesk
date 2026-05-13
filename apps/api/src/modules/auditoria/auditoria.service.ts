import { auditoriaRepository } from './auditoria.repository';
import type { AuditoriaEntry, ListAuditoriaQuery } from './auditoria.dto';

export const auditoriaService = {
  async list(query: ListAuditoriaQuery): Promise<{
    dados: AuditoriaEntry[];
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  }> {
    const { rows, total } = await auditoriaRepository.list(query);
    return {
      dados: rows,
      total,
      pagina: query.pagina,
      limite: query.limite,
      totalPaginas: Math.max(1, Math.ceil(total / query.limite)),
    };
  },
};
