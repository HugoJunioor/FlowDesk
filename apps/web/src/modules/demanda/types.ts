/**
 * Types do modulo Demanda. Espelha apps/api/src/modules/demanda/demanda.dto.ts.
 */
export type DemandPriority = 'p1' | 'p2' | 'p3' | 'sem_classificacao';
export type DemandStatus = 'aberta' | 'em_andamento' | 'concluida' | 'expirada';
export type DemandOrigin = 'slack' | 'internal';
export type InfraKind = 'sql' | 'deploy';

export interface DemandaQuery {
  pagina?: number;
  limite?: number;
  origem?: DemandOrigin;
  status?: DemandStatus;
  prioridade?: DemandPriority;
  responsavel?: string;
  busca?: string;
}

export interface Demanda {
  id: string;
  origem: DemandOrigin;
  titulo: string;
  descricao: string | null;
  prioridade: DemandPriority;
  status: DemandStatus;
  tipoDemanda: string | null;
  workflow: string | null;
  produto: string | null;
  solicitanteNome: string | null;
  solicitanteAvatar: string | null;
  responsavelNome: string | null;
  responsavelAvatar: string | null;
  infraKind: InfraKind | null;
  infraQuery: string | null;
  infraDatabase: string | null;
  infraExternalLink: string | null;
  canalSlack: string | null;
  permalinkSlack: string | null;
  replies: number;
  dueDate: string | null;
  concluidaEm: string | null;
  serviceStartedAt: string | null;
  hasTask: boolean;
  taskLink: string | null;
  tags: string[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface DemandaPaginated {
  dados: Demanda[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface CreateInfraInput {
  titulo: string;
  descricao?: string;
  prioridade?: DemandPriority;
  infraKind: InfraKind;
  infraQuery?: string;
  infraDatabase?: string;
  infraExternalLink?: string;
  responsavelNome?: string;
  dueDate?: string;
  tags?: string[];
}
