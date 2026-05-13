/**
 * Service de demandas.
 *
 * Regras de autorizacao:
 *   - Listar: qualquer user autenticado ve as demandas que o grupo permite
 *     (modulo 'demandas' ou 'infra'). Master ve tudo.
 *   - Criar Infra: precisa de permissao create no modulo 'infra'.
 *   - Editar: criador (solicitante) ou responsavel ou master.
 *   - Atender (status -> em_andamento): responsavel ou master.
 *   - Concluir (status -> concluida): responsavel ou master.
 *   - Excluir: master.
 */
import { NotFoundError, ForbiddenError, ConflictError } from '@shared/domain/errors';
import { demandaRepository } from './demanda.repository';
import type {
  CreateInfraInput,
  Demanda,
  ListDemandaQuery,
  UpdateDemandaInput,
} from './demanda.dto';

interface ActorCtx {
  nome: string;
  email: string;
  perfil: 'master' | 'user';
  avatar?: string | null;
}

function canEdit(d: Demanda, actor: ActorCtx): boolean {
  if (actor.perfil === 'master') return true;
  if (d.solicitanteNome && d.solicitanteNome === actor.nome) return true;
  if (d.responsavelNome && d.responsavelNome === actor.nome) return true;
  return false;
}

function canAct(d: Demanda, actor: ActorCtx): boolean {
  // Atender/concluir: responsavel ou master
  if (actor.perfil === 'master') return true;
  return d.responsavelNome === actor.nome;
}

export const demandaService = {
  async list(query: ListDemandaQuery): Promise<{
    dados: Demanda[];
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  }> {
    const { rows, total } = await demandaRepository.list(query);
    return {
      dados: rows,
      total,
      pagina: query.pagina,
      limite: query.limite,
      totalPaginas: Math.max(1, Math.ceil(total / query.limite)),
    };
  },

  async findById(id: string): Promise<Demanda> {
    const d = await demandaRepository.findById(id);
    if (!d) throw new NotFoundError('Demanda', id);
    return d;
  },

  async createInfra(input: CreateInfraInput, actor: ActorCtx): Promise<Demanda> {
    return demandaRepository.createInfra({
      solicitante: { nome: actor.nome, avatar: actor.avatar ?? null },
      input,
    });
  },

  async update(id: string, input: UpdateDemandaInput, actor: ActorCtx): Promise<Demanda> {
    const existing = await this.findById(id);
    if (!canEdit(existing, actor)) {
      throw new ForbiddenError('Sem permissão para editar esta demanda');
    }
    const updated = await demandaRepository.update(id, input);
    if (!updated) throw new NotFoundError('Demanda', id);
    return updated;
  },

  async atender(id: string, actor: ActorCtx): Promise<Demanda> {
    const existing = await this.findById(id);
    if (!canAct(existing, actor)) {
      throw new ForbiddenError('Apenas o responsável pode iniciar atendimento');
    }
    if (existing.status !== 'aberta') {
      throw new ConflictError(
        `Demanda já está em status "${existing.status}"`,
        'STATUS_INVALIDO',
      );
    }
    const updated = await demandaRepository.update(id, { status: 'em_andamento' });
    if (!updated) throw new NotFoundError('Demanda', id);
    return updated;
  },

  async concluir(id: string, actor: ActorCtx): Promise<Demanda> {
    const existing = await this.findById(id);
    if (!canAct(existing, actor)) {
      throw new ForbiddenError('Apenas o responsável pode concluir esta demanda');
    }
    if (existing.status === 'concluida') {
      throw new ConflictError('Demanda já está concluída', 'JA_CONCLUIDA');
    }
    const updated = await demandaRepository.update(id, { status: 'concluida' });
    if (!updated) throw new NotFoundError('Demanda', id);
    return updated;
  },

  async remove(id: string, actor: ActorCtx): Promise<void> {
    if (actor.perfil !== 'master') {
      throw new ForbiddenError('Apenas o master pode excluir demandas');
    }
    const existing = await this.findById(id);
    const removed = await demandaRepository.softDelete(existing.id);
    if (!removed) throw new NotFoundError('Demanda', id);
  },
};
