/**
 * DTOs do módulo Demanda — consolida Slack + Infra (via campo origem).
 *
 * Esta fase (6) cobre o fluxo de Infra (origem='internal'): full CRUD
 * + ações atender/concluir. Demandas Slack (origem='slack') terão
 * tratamento específico na Fase 7 (sync + threadReplies + overrides).
 */
import { z } from 'zod';

export const DEMAND_PRIORITIES = ['p1', 'p2', 'p3', 'sem_classificacao'] as const;
export const DEMAND_STATUSES = ['aberta', 'em_andamento', 'concluida', 'expirada'] as const;
export const DEMAND_ORIGINS = ['slack', 'internal'] as const;
export const INFRA_KINDS = ['sql', 'deploy'] as const;

export type DemandPriority = (typeof DEMAND_PRIORITIES)[number];
export type DemandStatus = (typeof DEMAND_STATUSES)[number];
export type DemandOrigin = (typeof DEMAND_ORIGINS)[number];
export type InfraKind = (typeof INFRA_KINDS)[number];

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const listDemandaQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(100).default(50),
  origem: z.enum(DEMAND_ORIGINS).optional(),
  status: z.enum(DEMAND_STATUSES).optional(),
  prioridade: z.enum(DEMAND_PRIORITIES).optional(),
  responsavel: z.string().optional(),
  busca: z.string().trim().min(1).optional(),
});
export type ListDemandaQuery = z.infer<typeof listDemandaQuerySchema>;

/** Cria demanda interna (Infra). Origem fixa em 'internal'. */
export const createInfraSchema = z.object({
  titulo: z.string().trim().min(1).max(500),
  descricao: z.string().max(20000).optional(),
  prioridade: z.enum(DEMAND_PRIORITIES).default('p3'),
  infraKind: z.enum(INFRA_KINDS),
  infraQuery: z.string().max(50000).optional(),
  infraDatabase: z.string().max(100).optional(),
  infraExternalLink: z.string().url().optional(),
  responsavelNome: z.string().max(200).default('Operador Infra'),
  responsavelAvatar: z.string().max(500).optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});
export type CreateInfraInput = z.infer<typeof createInfraSchema>;

export const updateDemandaSchema = z.object({
  titulo: z.string().trim().min(1).max(500).optional(),
  descricao: z.string().max(20000).optional(),
  prioridade: z.enum(DEMAND_PRIORITIES).optional(),
  status: z.enum(DEMAND_STATUSES).optional(),
  responsavelNome: z.string().max(200).nullable().optional(),
  responsavelAvatar: z.string().max(500).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  infraQuery: z.string().max(50000).optional(),
  infraDatabase: z.string().max(100).optional(),
  infraExternalLink: z.string().url().nullable().optional(),
  taskLink: z.string().url().nullable().optional(),
  hasTask: z.boolean().optional(),
});
export type UpdateDemandaInput = z.infer<typeof updateDemandaSchema>;

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
  dueDate: Date | null;
  concluidaEm: Date | null;
  serviceStartedAt: Date | null;
  hasTask: boolean;
  taskLink: string | null;
  tags: string[];
  criadoEm: Date;
  atualizadoEm: Date;
}
