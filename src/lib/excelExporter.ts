// xlsx-js-style: drop-in replacement for xlsx with full cell-style support
// Run: npm install xlsx-js-style --legacy-peer-deps
import * as XLSX from "xlsx-js-style";
import { SlackDemand, PRIORITY_CONFIG } from "@/types/demand";
import { getFirstResponseMinutes, getResolutionMinutes } from "./businessHours";
import { isSlaCompliant } from "./slaCalculator";

// ── Cell style constants ──────────────────────────────────────────────────────
// xlsx-js-style uses 6-char hex (no alpha prefix)

const HEADER_STYLE: XLSX.CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
  font: { color: { rgb: "FFFFFF" }, bold: true, name: "Arial", sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {},
};

const ROW_BASE: XLSX.CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
  font: { name: "Arial", sz: 10 },
  alignment: { vertical: "center" },
  border: {},
};

const GREEN: XLSX.CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "22C55E" } },
  font: { color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
  alignment: { vertical: "center", horizontal: "center" },
  border: {},
};

const BLUE: XLSX.CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "3B82F6" } },
  font: { color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
  alignment: { vertical: "center", horizontal: "center" },
  border: {},
};

const ORANGE: XLSX.CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "F97316" } },
  font: { color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
  alignment: { vertical: "center", horizontal: "center" },
  border: {},
};

const RED: XLSX.CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "EF4444" } },
  font: { color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
  alignment: { vertical: "center", horizontal: "center" },
  border: {},
};

const LINK_STYLE: XLSX.CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
  font: { color: { rgb: "1E40AF" }, name: "Arial", sz: 10, underline: true },
  alignment: { vertical: "center" },
  border: {},
};

// ── Generic helpers ───────────────────────────────────────────────────────────

function extractClientName(channel: string): string {
  const match = channel.match(/#cliente-(.+)/);
  if (!match) return channel;
  const raw = match[1].replace(/-/g, " ");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

function formatHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}

function parseResponseSla(sla: string): number {
  if (!sla) return 60;
  const match = sla.match(/(\d+)\s*(min|hora|horas)/i);
  if (!match) return 60;
  const val = parseInt(match[1]);
  return match[2].toLowerCase().startsWith("hora") ? val * 60 : val;
}

/**
 * Compute runtime SLA resolution status usando a MESMA logica do dashboard
 * (horas uteis + feriados). Retorna atendido/expirado/aberto.
 */
function computeResolutionStatus(d: SlackDemand): "atendido" | "expirado" | "aberto" {
  if (d.slaResolutionStatus === "atendido" || d.slaResolutionStatus === "expirado") {
    return d.slaResolutionStatus;
  }
  if (d.status === "expirada") return "expirado";
  if (d.status === "concluida" && d.completedAt) {
    return isSlaCompliant(d) ? "atendido" : "expirado";
  }
  return "aberto";
}

// ── Cell factory ──────────────────────────────────────────────────────────────

function cell(value: string | number, style: XLSX.CellStyle): XLSX.CellObject {
  return { v: value, t: typeof value === "number" ? "n" : "s", s: style } as XLSX.CellObject;
}

function hlink(value: string, target: string, style: XLSX.CellStyle): XLSX.CellObject {
  return { v: value, t: "s", l: { Target: target }, s: style } as XLSX.CellObject;
}

// ── Sheet: Demandas ─────────────────────────────────────────────────────────

function buildDemandasSheet(demands: SlackDemand[]): XLSX.WorkSheet {
  const headers = [
    "Canal Slack", "Cliente", "Título / Link Slack", "Tipo", "Prioridade",
    "Status", "Motivo Expiração", "Solicitante", "Responsável",
    "Aberto em", "Concluído em", "Tem Task?", "Link Task",
    "SLA 1ª Resposta", "Status 1ª Resposta", "Tempo Resolução",
    "Status Resolução SLA", "Categoria", "Nível Suporte", "Observação",
  ];

  const NUM_COLS = headers.length;
  const ws: XLSX.WorkSheet = {};

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: demands.length, c: NUM_COLS - 1 },
  });

  // Header row
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = cell(h, HEADER_STYLE);
  });

  // Data rows
  demands.forEach((d, rowIdx) => {
    const r = rowIdx + 1;

    // ── SLA data: use stored value or compute dynamically ──────────────────
    // getFirstResponseMinutes: if slaFirstResponse is set it returns it; else computes from threadReplies
    const computedFirstResp = getFirstResponseMinutes(d.createdAt, d.threadReplies, d.slaFirstResponse);

    // resolutionHours: prefer stored (historical), else derive from business minutes
    const computedResHours: number | null = (() => {
      if (d.resolutionHours != null) return d.resolutionHours;
      const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
      return resMins != null ? resMins / 60 : null;
    })();

    // ── Col 0: Canal Slack ───────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(d.slackChannel, ROW_BASE);

    // ── Col 1: Cliente ───────────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = cell(extractClientName(d.slackChannel), ROW_BASE);

    // ── Col 2: Título / Link Slack ───────────────────────────────────────
    if (d.slackPermalink) {
      ws[XLSX.utils.encode_cell({ r, c: 2 })] = hlink(d.title, d.slackPermalink, LINK_STYLE);
    } else {
      ws[XLSX.utils.encode_cell({ r, c: 2 })] = cell(d.title, ROW_BASE);
    }

    // ── Col 3: Tipo ──────────────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 3 })] = cell(d.demandType, ROW_BASE);

    // ── Col 4: Prioridade ────────────────────────────────────────────────
    const priorityLabel: Record<string, string> = {
      p1: "P1 - Crítico", p2: "P2 - Alta", p3: "P3 - Média",
      sem_classificacao: "Sem Classificação",
    };
    ws[XLSX.utils.encode_cell({ r, c: 4 })] = cell(priorityLabel[d.priority] ?? d.priority, ROW_BASE);

    // ── Col 5: Status ────────────────────────────────────────────────────
    let statusLabel: string;
    let statusStyle: XLSX.CellStyle;
    if (d.status === "concluida") {
      statusLabel = "Concluído"; statusStyle = GREEN;
    } else if (d.status === "expirada") {
      statusLabel = "Expirado"; statusStyle = ORANGE;
    } else if (d.status === "em_andamento") {
      statusLabel = "Em Andamento"; statusStyle = BLUE;
    } else {
      statusLabel = "Aberta"; statusStyle = BLUE;
    }
    ws[XLSX.utils.encode_cell({ r, c: 5 })] = cell(statusLabel, statusStyle);

    // ── Col 6: Motivo Expiração ──────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 6 })] = cell(d.expirationReason ?? d.closure?.expirationReason ?? "", ROW_BASE);

    // ── Col 7: Solicitante ───────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 7 })] = cell(d.requester.name, ROW_BASE);

    // ── Col 8: Responsável ───────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 8 })] = cell(d.assignee?.name ?? "", ROW_BASE);

    // ── Col 9: Aberto em ─────────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 9 })] = cell(formatDate(d.createdAt), ROW_BASE);

    // ── Col 10: Concluído em ─────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 10 })] = cell(formatDate(d.completedAt), ROW_BASE);

    // ── Col 11: Tem Task? ────────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 11 })] = cell(d.hasTask ? "Sim" : "Não", ROW_BASE);

    // ── Col 12: Link Task ────────────────────────────────────────────────
    if (d.taskLink) {
      ws[XLSX.utils.encode_cell({ r, c: 12 })] = hlink("Abrir Task", d.taskLink, LINK_STYLE);
    } else {
      ws[XLSX.utils.encode_cell({ r, c: 12 })] = cell("", ROW_BASE);
    }

    // ── Col 13: SLA 1ª Resposta ──────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 13 })] = cell(formatMinutes(computedFirstResp), ROW_BASE);

    // ── Col 14: Status 1ª Resposta ───────────────────────────────────────
    const slaThresh =
      d.priority !== "sem_classificacao" && PRIORITY_CONFIG[d.priority]?.sla
        ? parseResponseSla(PRIORITY_CONFIG[d.priority].sla!.response)
        : null;

    let firstRespLabel: string;
    let firstRespStyle: XLSX.CellStyle;
    if (computedFirstResp == null || slaThresh == null) {
      firstRespLabel = "—"; firstRespStyle = ROW_BASE;
    } else if (computedFirstResp <= slaThresh) {
      firstRespLabel = "Dentro do prazo"; firstRespStyle = GREEN;
    } else {
      firstRespLabel = "Fora do prazo"; firstRespStyle = RED;
    }
    ws[XLSX.utils.encode_cell({ r, c: 14 })] = cell(firstRespLabel, firstRespStyle);

    // ── Col 15: Tempo Resolução ──────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 15 })] = cell(
      computedResHours != null ? formatHours(computedResHours) : "—",
      ROW_BASE,
    );

    // ── Col 16: Status Resolução SLA ─────────────────────────────────────
    const resSt = computeResolutionStatus(d);
    let resSlaBrLabel: string;
    let resSlaStyle: XLSX.CellStyle;
    if (resSt === "atendido") {
      resSlaBrLabel = "Dentro do prazo"; resSlaStyle = GREEN;
    } else if (resSt === "expirado") {
      resSlaBrLabel = "Fora do prazo"; resSlaStyle = RED;
    } else {
      resSlaBrLabel = "Em aberto"; resSlaStyle = BLUE;
    }
    ws[XLSX.utils.encode_cell({ r, c: 16 })] = cell(resSlaBrLabel, resSlaStyle);

    // ── Col 17: Categoria ─────────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 17 })] = cell(d.closure?.category ?? "", ROW_BASE);

    // ── Col 18: Nível Suporte ─────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 18 })] = cell(d.closure?.supportLevel ?? "", ROW_BASE);

    // ── Col 19: Observação ────────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r, c: 19 })] = cell(d.closure?.internalComment ?? "", ROW_BASE);
  });

  // Column widths
  ws["!cols"] = [
    { wch: 22 }, // Canal Slack
    { wch: 16 }, // Cliente
    { wch: 42 }, // Título / Link Slack
    { wch: 15 }, // Tipo
    { wch: 15 }, // Prioridade
    { wch: 14 }, // Status
    { wch: 26 }, // Motivo Expiração
    { wch: 20 }, // Solicitante
    { wch: 18 }, // Responsável
    { wch: 17 }, // Aberto em
    { wch: 17 }, // Concluído em
    { wch: 10 }, // Tem Task?
    { wch: 12 }, // Link Task
    { wch: 17 }, // SLA 1ª Resposta
    { wch: 18 }, // Status 1ª Resposta
    { wch: 17 }, // Tempo Resolução
    { wch: 18 }, // Status Resolução SLA
    { wch: 18 }, // Categoria
    { wch: 13 }, // Nível Suporte
    { wch: 32 }, // Observação
  ];

  // Row heights: header taller, data rows with comfortable spacing
  ws["!rows"] = [
    { hpt: 30 }, // header
    ...Array.from({ length: demands.length }, () => ({ hpt: 26 })),
  ];

  // Freeze first row
  ws["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];

  return ws;
}

// ── Main export function ──────────────────────────────────────────────────────

export function exportToExcel(demands: SlackDemand[], title: string): void {
  void title;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildDemandasSheet(demands), "Demandas");

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Demandas_FlowDesk_${dateStr}.xlsx`, {
    cellStyles: true,
    bookSST: false,
  });
}
