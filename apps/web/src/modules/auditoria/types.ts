/**
 * Types do módulo Auditoria. Espelha
 * apps/api/src/modules/auditoria/auditoria.dto.ts.
 */
export interface AuditoriaEntry {
  id: string;
  usuarioEmail: string | null;
  recurso: string;
  recursoId: string | null;
  acao: string;
  payloadAntes: unknown;
  payloadDepois: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  criadoEm: string;
}

export interface AuditoriaQuery {
  pagina?: number;
  limite?: number;
  recurso?: string;
  acao?: string;
  usuarioEmail?: string;
  from?: string;
  to?: string;
}

export interface AuditoriaPaginated {
  dados: AuditoriaEntry[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}
