/**
 * FONTE UNICA DE VERDADE para metricas e SLA das demandas.
 *
 * Este modulo e usado pelo Dashboard (Index.tsx), Demandas (Demandas.tsx),
 * relatorio BI (reportGenerator.ts) e exportacao Excel (excelExporter.ts).
 *
 * Qualquer numero que apareca na tela DEVE vir daqui, para que os
 * relatorios batam 100% com o que o usuario ve no sistema.
 */
import { SlackDemand, PRIORITY_CONFIG } from "@/types/demand";
import {
  addBusinessHours,
  getFirstResponseMinutes,
  getResolutionMinutes,
  isExcludedFromFirstResponseSla,
} from "@/lib/businessHours";

/** Converte "15 min" / "1 hora" / "4 horas" em minutos. */
export function parseResponseSla(sla: string): number {
  const match = sla.match(/(\d+)\s*(min|hora|horas)/i);
  if (!match) return 60;
  const val = parseInt(match[1]);
  return match[2].startsWith("hora") ? val * 60 : val;
}

/**
 * SLA de resolucao foi CUMPRIDO?
 * - Historico (tem slaResolutionStatus): usa o valor da planilha
 * - Abril+ concluida: compara completedAt com SLA em horas uteis
 * - Abril+ em andamento: compara agora com prazo (se ainda dentro = compliant)
 * - Expirada: sempre false
 */
export function isSlaCompliant(d: SlackDemand): boolean {
  if (d.slaResolutionStatus === "atendido") return true;
  if (d.slaResolutionStatus === "expirado") return false;
  if (d.priority === "sem_classificacao") return true;
  const config = PRIORITY_CONFIG[d.priority];
  if (!config?.sla) return true;
  if (d.status === "concluida" && d.completedAt) {
    return (
      new Date(d.completedAt) <=
      addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours)
    );
  }
  if (d.status === "expirada") return false;
  return (
    new Date() <= addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours)
  );
}

/** SLA foi ESTOURADO? (inverso logico de compliant, mas explicito pra clareza) */
export function isSlaBreached(d: SlackDemand): boolean {
  if (d.slaResolutionStatus) return d.slaResolutionStatus === "expirado";
  if (d.priority === "sem_classificacao") return false;
  const config = PRIORITY_CONFIG[d.priority];
  if (!config?.sla) return false;
  if (d.status === "concluida" && d.completedAt) {
    return (
      new Date(d.completedAt) >
      addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours)
    );
  }
  if (d.status !== "concluida" && d.status !== "expirada") {
    return (
      new Date() > addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours)
    );
  }
  return d.status === "expirada";
}

export interface DemandMetrics {
  total: number;
  abertas: number;
  emAndamento: number;
  concluidas: number;
  expiradas: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  semClassificacao: number;
  /** SLA de resolucao — taxa de cumprimento (%) */
  slaResolutionRate: number;
  slaResolutionOk: number;
  slaResolutionBreach: number;
  slaResolutionTotal: number;
  /** SLA de 1a resposta */
  slaFirstResponseRate: number;
  slaFirstResponseOk: number;
  slaFirstResponseBreach: number;
  slaFirstResponseAvgMinutes: number;
  /** SLA estourado (total absoluto) */
  slaBreachedCount: number;
}

/**
 * Calcula TODAS as metricas SLA do conjunto de demandas.
 * Mesma logica usada no Dashboard, no BI e no Excel.
 */
export function computeDemandMetrics(demands: SlackDemand[]): DemandMetrics {
  const total = demands.length;
  const abertas = demands.filter((d) => d.status === "aberta").length;
  const emAndamento = demands.filter((d) => d.status === "em_andamento").length;
  const concluidas = demands.filter((d) => d.status === "concluida").length;
  const expiradas = demands.filter((d) => d.status === "expirada").length;
  const p1Count = demands.filter((d) => d.priority === "p1").length;
  const p2Count = demands.filter((d) => d.priority === "p2").length;
  const p3Count = demands.filter((d) => d.priority === "p3").length;
  const semClassificacao = demands.filter((d) => d.priority === "sem_classificacao").length;

  // Demandas que tem SLA (com prioridade definida e config)
  const withSla = demands.filter(
    (d) => d.priority !== "sem_classificacao" && PRIORITY_CONFIG[d.priority]?.sla
  );

  // === SLA Resolucao ===
  let slaResOk = 0;
  let slaResBreach = 0;
  for (const d of withSla) {
    if (d.slaResolutionStatus === "atendido") {
      slaResOk++;
    } else if (d.slaResolutionStatus === "expirado") {
      slaResBreach++;
    } else {
      const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
      const cfg = PRIORITY_CONFIG[d.priority];
      if (resMins !== null && cfg?.sla) {
        if (resMins <= cfg.sla.resolutionHours * 60) slaResOk++;
        else slaResBreach++;
      } else if (d.status === "expirada") {
        slaResBreach++;
      }
    }
  }
  const slaResolutionTotal = slaResOk + slaResBreach;
  const slaResolutionRate =
    slaResolutionTotal > 0 ? Math.floor((slaResOk / slaResolutionTotal) * 100) : 100;

  // === SLA 1a Resposta ===
  let slaRespOk = 0;
  let slaRespBreach = 0;
  let sumFirstResp = 0;
  let countFirstResp = 0;
  for (const d of withSla) {
    if (isExcludedFromFirstResponseSla(d)) continue;
    const cfg = PRIORITY_CONFIG[d.priority];
    if (!cfg?.sla) continue;
    const frMins = getFirstResponseMinutes(d.createdAt, d.threadReplies, d.slaFirstResponse);
    if (frMins !== null) {
      countFirstResp++;
      sumFirstResp += frMins;
      const slaRespMins = parseResponseSla(cfg.sla.response);
      if (frMins <= slaRespMins) slaRespOk++;
      else slaRespBreach++;
    } else if (
      d.slaResolutionStatus === "atendido" ||
      d.slaResolutionStatus === "expirado"
    ) {
      // Historico sem registro de resposta: conta como violacao
      slaRespBreach++;
    }
  }
  const slaFirstResponseTotal = slaRespOk + slaRespBreach;
  const slaFirstResponseRate =
    slaFirstResponseTotal > 0 ? Math.floor((slaRespOk / slaFirstResponseTotal) * 100) : 100;
  const slaFirstResponseAvgMinutes =
    countFirstResp > 0 ? Math.round(sumFirstResp / countFirstResp) : 0;

  const slaBreachedCount = demands.filter(isSlaBreached).length;

  return {
    total,
    abertas,
    emAndamento,
    concluidas,
    expiradas,
    p1Count,
    p2Count,
    p3Count,
    semClassificacao,
    slaResolutionRate,
    slaResolutionOk: slaResOk,
    slaResolutionBreach: slaResBreach,
    slaResolutionTotal,
    slaFirstResponseRate,
    slaFirstResponseOk: slaRespOk,
    slaFirstResponseBreach: slaRespBreach,
    slaFirstResponseAvgMinutes,
    slaBreachedCount,
  };
}
