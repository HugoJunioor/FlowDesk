import { SlackDemand, PRIORITY_CONFIG, STATUS_CONFIG, DemandPriority } from "@/types/demand";
import { getFirstResponseMinutes, getResolutionMinutes, isExcludedFromFirstResponseSla } from "./businessHours";
import { branding } from "@/config/brandingLoader";

interface ReportOptions {
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  demands: SlackDemand[];
  generatedFrom: "dashboard" | "demandas";
}

function parseResponseSla(slaStr: string): number {
  if (!slaStr) return Infinity;
  const lower = slaStr.toLowerCase();
  const num = parseFloat(lower);
  if (lower.includes("hora")) return num * 60;
  if (lower.includes("min")) return num;
  return Infinity;
}

function formatMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${Math.round(mins)}min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractClientName(channel: string): string {
  const match = channel.match(/#cliente-(.+)/);
  if (!match) return channel;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}

function priorityLabel(p: string): string {
  const cfg = PRIORITY_CONFIG[p as DemandPriority];
  return cfg?.shortLabel || "—";
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    aberta: "Aberta",
    em_andamento: "Em Andamento",
    concluida: "Concluída",
    expirada: "Expirada",
  };
  return map[s] || s;
}

export function generateInteractiveReport(options: ReportOptions): string {
  const { title, subtitle, filters, demands, generatedFrom } = options;
  const now = new Date();
  const brandName = branding.name || "FlowDesk";

  // === COMPUTE METRICS ===
  const total = demands.length;
  const abertas = demands.filter((d) => d.status === "aberta" || d.status === "em_andamento").length;
  const concluidas = demands.filter((d) => d.status === "concluida").length;
  const expiradas = demands.filter((d) => d.status === "expirada").length;
  const emAndamento = demands.filter((d) => d.status === "em_andamento").length;
  const p1Count = demands.filter((d) => d.priority === "p1").length;
  const p2Count = demands.filter((d) => d.priority === "p2").length;
  const p3Count = demands.filter((d) => d.priority === "p3").length;

  // SLA calculations
  const withSla = demands.filter((d) => d.priority !== "sem_classificacao" && PRIORITY_CONFIG[d.priority]?.sla);

  let slaResOk = 0;
  let slaResBreach = 0;
  let slaRespOk = 0;
  let slaRespBreach = 0;
  let totalFirstResp = 0;
  let sumFirstResp = 0;

  for (const d of withSla) {
    const cfg = PRIORITY_CONFIG[d.priority];
    if (!cfg?.sla) continue;

    // Resolution SLA
    const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
    if (resMins !== null) {
      if (resMins <= cfg.sla.resolutionHours * 60) slaResOk++;
      else slaResBreach++;
    }

    // First response SLA (exclui conciliação e remessa SITEF)
    if (!isExcludedFromFirstResponseSla(d)) {
      const frMins = getFirstResponseMinutes(d.createdAt, d.threadReplies);
      if (frMins !== null) {
        totalFirstResp++;
        sumFirstResp += frMins;
        const slaRespMins = parseResponseSla(cfg.sla.response);
        if (frMins <= slaRespMins) slaRespOk++;
        else slaRespBreach++;
      }
    }
  }

  const avgFirstResp = totalFirstResp > 0 ? sumFirstResp / totalFirstResp : 0;
  const slaResRate = slaResOk + slaResBreach > 0 ? Math.round((slaResOk / (slaResOk + slaResBreach)) * 100) : 0;
  const slaRespRate = slaRespOk + slaRespBreach > 0 ? Math.round((slaRespOk / (slaRespOk + slaRespBreach)) * 100) : 0;

  // Status distribution
  const statusData = {
    aberta: demands.filter((d) => d.status === "aberta").length,
    em_andamento: emAndamento,
    concluida: concluidas,
    expirada: expiradas,
  };

  // Priority distribution
  const priorityData = { p1: p1Count, p2: p2Count, p3: p3Count, sem: demands.filter((d) => d.priority === "sem_classificacao").length };

  // Client breakdown
  const clientMap: Record<string, { total: number; aberta: number; concluida: number; expirada: number }> = {};
  for (const d of demands) {
    const client = extractClientName(d.slackChannel);
    if (!clientMap[client]) clientMap[client] = { total: 0, aberta: 0, concluida: 0, expirada: 0 };
    clientMap[client].total++;
    if (d.status === "aberta" || d.status === "em_andamento") clientMap[client].aberta++;
    else if (d.status === "concluida") clientMap[client].concluida++;
    else if (d.status === "expirada") clientMap[client].expirada++;
  }
  const clientEntries = Object.entries(clientMap).sort((a, b) => b[1].total - a[1].total);

  // Assignee workload
  const assigneeMap: Record<string, { total: number; aberta: number; concluida: number }> = {};
  for (const d of demands) {
    const name = d.assignee?.name || "Sem responsável";
    if (!assigneeMap[name]) assigneeMap[name] = { total: 0, aberta: 0, concluida: 0 };
    assigneeMap[name].total++;
    if (d.status === "aberta" || d.status === "em_andamento") assigneeMap[name].aberta++;
    else if (d.status === "concluida") assigneeMap[name].concluida++;
  }
  const assigneeEntries = Object.entries(assigneeMap).sort((a, b) => b[1].total - a[1].total);

  // Category distribution
  const categoryMap: Record<string, number> = {};
  for (const d of demands) {
    const cat = d.closure?.category || "Sem categoria";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  }
  const categoryEntries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Type distribution
  const typeMap: Record<string, number> = {};
  for (const d of demands) {
    typeMap[d.demandType] = (typeMap[d.demandType] || 0) + 1;
  }

  // Timeline (by day)
  const timelineMap: Record<string, { criadas: number; concluidas: number }> = {};
  for (const d of demands) {
    const day = d.createdAt.slice(0, 10);
    if (!timelineMap[day]) timelineMap[day] = { criadas: 0, concluidas: 0 };
    timelineMap[day].criadas++;
  }
  for (const d of demands.filter((d) => d.completedAt)) {
    const day = d.completedAt!.slice(0, 10);
    if (!timelineMap[day]) timelineMap[day] = { criadas: 0, concluidas: 0 };
    timelineMap[day].concluidas++;
  }
  const timelineDays = Object.keys(timelineMap).sort();

  // Demand type breakdown
  const typeEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

  // SLA per priority
  const slaPriorityData: Record<string, { ok: number; breach: number }> = { p1: { ok: 0, breach: 0 }, p2: { ok: 0, breach: 0 }, p3: { ok: 0, breach: 0 } };
  for (const d of withSla) {
    const cfg = PRIORITY_CONFIG[d.priority];
    if (!cfg?.sla || !slaPriorityData[d.priority]) continue;
    const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
    if (resMins !== null) {
      if (resMins <= cfg.sla.resolutionHours * 60) slaPriorityData[d.priority].ok++;
      else slaPriorityData[d.priority].breach++;
    }
  }

  // Filter description
  const filterDesc = filters
    ? Object.entries(filters)
        .filter(([, v]) => v && v !== "all" && v !== "Todos" && v !== "")
        .map(([k, v]) => `<span class="filter-tag">${escapeHtml(k)}: ${escapeHtml(v)}</span>`)
        .join(" ")
    : "";

  // === TABLE ROWS ===
  const tableRows = demands
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((d) => {
      const client = extractClientName(d.slackChannel);
      const frMins = getFirstResponseMinutes(d.createdAt, d.threadReplies);
      const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
      const cfg = PRIORITY_CONFIG[d.priority];
      const slaRespLimit = cfg?.sla ? parseResponseSla(cfg.sla.response) : null;
      const slaResLimit = cfg?.sla ? cfg.sla.resolutionHours * 60 : null;

      const frStatus = frMins !== null && slaRespLimit !== null ? (frMins <= slaRespLimit ? "ok" : "breach") : "na";
      const resStatus = resMins !== null && slaResLimit !== null ? (resMins <= slaResLimit ? "ok" : "breach") : "na";

      const priorityClass = d.priority === "p1" ? "priority-p1" : d.priority === "p2" ? "priority-p2" : d.priority === "p3" ? "priority-p3" : "priority-none";
      const statusClass = d.status === "concluida" ? "status-done" : d.status === "expirada" ? "status-expired" : d.status === "em_andamento" ? "status-progress" : "status-open";

      return `<tr class="table-row" data-status="${d.status}" data-priority="${d.priority}" data-client="${escapeHtml(client.toLowerCase())}">
        <td><a href="${escapeHtml(d.slackPermalink)}" target="_blank" class="thread-link" title="Abrir thread no Slack">${escapeHtml(d.title.slice(0, 60))}${d.title.length > 60 ? "…" : ""}</a></td>
        <td>${escapeHtml(client)}</td>
        <td><span class="badge ${priorityClass}">${priorityLabel(d.priority)}</span></td>
        <td><span class="badge ${statusClass}">${statusLabel(d.status)}</span></td>
        <td>${escapeHtml(d.assignee?.name || "—")}</td>
        <td>${new Date(d.createdAt).toLocaleDateString("pt-BR")} ${new Date(d.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
        <td><span class="sla-badge sla-${frStatus}">${frMins !== null ? formatMinutes(frMins) : "—"}</span></td>
        <td><span class="sla-badge sla-${resStatus}">${resMins !== null ? formatMinutes(resMins) : "—"}</span></td>
        <td>${d.replies}</td>
      </tr>`;
    })
    .join("\n");

  // === HTML ===
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} - ${brandName}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
  :root, [data-theme="dark"] {
    --bg: #0f1729;
    --bg-card: #1a2332;
    --bg-card-hover: #1e2b3d;
    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
    --border: #2a3a4e;
    --primary: #3b82f6;
    --primary-light: #60a5fa;
    --success: #22c55e;
    --success-bg: rgba(34, 197, 94, 0.12);
    --warning: #f59e0b;
    --warning-bg: rgba(245, 158, 11, 0.12);
    --danger: #ef4444;
    --danger-bg: rgba(239, 68, 68, 0.12);
    --info: #06b6d4;
    --info-bg: rgba(6, 182, 212, 0.12);
    --purple: #a855f7;
    --purple-bg: rgba(168, 85, 247, 0.12);
    --radius: 12px;
    --shadow: 0 4px 24px rgba(0,0,0,0.3);
  }

  [data-theme="light"] {
    --bg: #f1f5f9;
    --bg-card: #ffffff;
    --bg-card-hover: #f8fafc;
    --text: #0f172a;
    --text-muted: #475569;
    --text-dim: #64748b;
    --border: #e2e8f0;
    --primary: #2563eb;
    --primary-light: #3b82f6;
    --success: #16a34a;
    --success-bg: rgba(22, 163, 74, 0.1);
    --warning: #d97706;
    --warning-bg: rgba(217, 119, 6, 0.1);
    --danger: #dc2626;
    --danger-bg: rgba(220, 38, 38, 0.1);
    --info: #0891b2;
    --info-bg: rgba(8, 145, 178, 0.1);
    --purple: #9333ea;
    --purple-bg: rgba(147, 51, 234, 0.1);
    --shadow: 0 4px 24px rgba(0,0,0,0.08);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

  .header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e40af 100%);
    padding: 40px 48px;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: rgba(255,255,255,0.03);
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -60%;
    left: 20%;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: rgba(255,255,255,0.02);
  }
  .header-content { position: relative; z-index: 1; max-width: 1400px; margin: 0 auto; }
  .header h1 { font-size: 28px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
  .header .subtitle { font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 6px; }
  .header .meta { display: flex; gap: 24px; margin-top: 16px; flex-wrap: wrap; align-items: center; }
  .header .meta-item { font-size: 12px; color: rgba(255,255,255,0.55); display: flex; align-items: center; gap: 6px; }
  .filter-tags { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-tag { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); padding: 4px 12px; border-radius: 20px; font-size: 11px; backdrop-filter: blur(4px); }

  .container { max-width: 1400px; margin: 0 auto; padding: 32px 48px 64px; }

  /* KPI Cards */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .kpi-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px 24px;
    position: relative;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
  .kpi-card .kpi-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    margin-bottom: 12px;
  }
  .kpi-card .kpi-value { font-size: 32px; font-weight: 800; line-height: 1; letter-spacing: -1px; }
  .kpi-card .kpi-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-card .kpi-sub { font-size: 11px; color: var(--text-dim); margin-top: 8px; }
  .kpi-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; }

  /* Charts */
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .chart-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
  }
  .chart-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: var(--text); }
  .chart-card canvas { max-height: 280px; }

  .charts-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 32px; }

  /* SLA Gauges */
  .sla-gauges { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .gauge-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    text-align: center;
  }
  .gauge-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; }
  .gauge-value { font-size: 48px; font-weight: 800; letter-spacing: -2px; }
  .gauge-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
  .gauge-bar { height: 8px; background: var(--border); border-radius: 4px; margin-top: 16px; overflow: hidden; }
  .gauge-fill { height: 100%; border-radius: 4px; transition: width 1s ease; }
  .gauge-details { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: var(--text-dim); }

  /* Table */
  .table-section { margin-top: 32px; }
  .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
  .table-header h2 { font-size: 18px; font-weight: 700; }
  .table-controls { display: flex; gap: 8px; align-items: center; }
  .table-search {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    color: var(--text);
    font-size: 13px;
    outline: none;
    width: 260px;
    transition: border-color 0.2s;
  }
  .table-search:focus { border-color: var(--primary); }
  .table-search::placeholder { color: var(--text-dim); }

  .table-filter-btn {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .table-filter-btn:hover, .table-filter-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

  .table-wrap {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    text-align: left;
    padding: 14px 16px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-dim);
    background: rgba(0,0,0,0.2);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }
  thead th:hover { color: var(--primary-light); }
  tbody td { padding: 12px 16px; border-bottom: 1px solid rgba(42,58,78,0.5); }
  .table-row { transition: background 0.15s; }
  .table-row:hover { background: var(--bg-card-hover); }
  .table-row.hidden { display: none; }

  .thread-link { color: var(--primary-light); text-decoration: none; font-weight: 500; }
  .thread-link:hover { text-decoration: underline; color: #93c5fd; }

  /* Badges */
  .badge { padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; display: inline-block; }
  .priority-p1 { background: var(--danger-bg); color: var(--danger); }
  .priority-p2 { background: var(--warning-bg); color: var(--warning); }
  .priority-p3 { background: var(--info-bg); color: var(--info); }
  .priority-none { background: rgba(100,116,139,0.15); color: var(--text-dim); }

  .status-open { background: rgba(59,130,246,0.12); color: var(--primary-light); }
  .status-progress { background: var(--purple-bg); color: var(--purple); }
  .status-done { background: var(--success-bg); color: var(--success); }
  .status-expired { background: var(--danger-bg); color: var(--danger); }

  .sla-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .sla-ok { background: var(--success-bg); color: var(--success); }
  .sla-breach { background: var(--danger-bg); color: var(--danger); }
  .sla-na { color: var(--text-dim); }

  /* Footer */
  .footer { text-align: center; padding: 32px; color: var(--text-dim); font-size: 11px; border-top: 1px solid var(--border); margin-top: 48px; }
  .footer a { color: var(--primary-light); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }

  /* Theme toggle */
  .theme-toggle {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 100;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 14px;
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
    box-shadow: var(--shadow);
    backdrop-filter: blur(8px);
  }
  .theme-toggle:hover { background: var(--bg-card-hover); border-color: var(--primary); }

  [data-theme="light"] .header { background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%); }
  [data-theme="light"] thead th { background: rgba(0,0,0,0.04); }
  [data-theme="light"] tbody td { border-bottom-color: #f1f5f9; }
  [data-theme="light"] .table-row:hover { background: #f8fafc; }

  /* Table pagination */
  .pagination { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-size: 12px; color: var(--text-muted); }
  .pagination button {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 14px;
    color: var(--text);
    font-size: 12px;
    cursor: pointer;
  }
  .pagination button:hover { background: var(--primary); border-color: var(--primary); }
  .pagination button:disabled { opacity: 0.3; cursor: default; }

  /* Print */
  @media print {
    body { background: #fff; color: #1a1a1a; }
    .header { background: #2563eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .kpi-card, .chart-card, .gauge-card, .table-wrap { border-color: #e2e8f0; background: #fff; }
    .table-controls, .pagination { display: none; }
  }

  @media (max-width: 1024px) {
    .charts-grid, .sla-gauges { grid-template-columns: 1fr; }
    .charts-grid-3 { grid-template-columns: 1fr; }
    .container { padding: 20px; }
    .header { padding: 28px 20px; }
  }
  @media (max-width: 768px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body data-theme="dark">

<button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="Alternar tema">
  <span id="themeIcon">☀️</span>
  <span id="themeLabel">Tema Claro</span>
</button>

<div class="header">
  <div class="header-content">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
    <div class="meta">
      <div class="meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div class="meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        ${total} demandas analisadas
      </div>
      <div class="meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Horário comercial: Seg-Sex 8h-18h
      </div>
    </div>
    ${filterDesc ? `<div class="filter-tags">${filterDesc}</div>` : ""}
  </div>
</div>

<div class="container">

  <!-- KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-accent" style="background: linear-gradient(90deg, var(--primary), var(--info))"></div>
      <div class="kpi-icon" style="background: rgba(59,130,246,0.12); color: var(--primary)">📊</div>
      <div class="kpi-value">${total}</div>
      <div class="kpi-label">Total de Demandas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background: var(--primary)"></div>
      <div class="kpi-icon" style="background: rgba(59,130,246,0.12); color: var(--primary-light)">📂</div>
      <div class="kpi-value" style="color: var(--primary-light)">${abertas}</div>
      <div class="kpi-label">Abertas</div>
      <div class="kpi-sub">${emAndamento} em andamento</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background: var(--success)"></div>
      <div class="kpi-icon" style="background: var(--success-bg); color: var(--success)">✅</div>
      <div class="kpi-value" style="color: var(--success)">${concluidas}</div>
      <div class="kpi-label">Concluídas</div>
      <div class="kpi-sub">${total > 0 ? Math.round((concluidas / total) * 100) : 0}% do total</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background: var(--danger)"></div>
      <div class="kpi-icon" style="background: var(--danger-bg); color: var(--danger)">🔥</div>
      <div class="kpi-value" style="color: var(--danger)">${p1Count}</div>
      <div class="kpi-label">P1 Críticos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background: var(--warning)"></div>
      <div class="kpi-icon" style="background: var(--warning-bg); color: var(--warning)">⏱️</div>
      <div class="kpi-value" style="color: var(--warning)">${formatMinutes(avgFirstResp)}</div>
      <div class="kpi-label">Tempo Médio 1ª Resp.</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background: ${slaResBreach > 0 ? 'var(--danger)' : 'var(--success)'}"></div>
      <div class="kpi-icon" style="background: ${slaResBreach > 0 ? 'var(--danger-bg)' : 'var(--success-bg)'}; color: ${slaResBreach > 0 ? 'var(--danger)' : 'var(--success)'}">🛡️</div>
      <div class="kpi-value" style="color: ${slaResBreach > 0 ? 'var(--danger)' : 'var(--success)'}">${slaResBreach}</div>
      <div class="kpi-label">SLA Estourado</div>
    </div>
  </div>

  <!-- SLA Gauges -->
  <div class="sla-gauges">
    <div class="gauge-card">
      <h3>SLA de Resolução</h3>
      <div class="gauge-value" style="color: ${slaResRate >= 80 ? 'var(--success)' : slaResRate >= 60 ? 'var(--warning)' : 'var(--danger)'}">${slaResRate}%</div>
      <div class="gauge-label">das demandas resolvidas no prazo</div>
      <div class="gauge-bar"><div class="gauge-fill" style="width: ${slaResRate}%; background: ${slaResRate >= 80 ? 'var(--success)' : slaResRate >= 60 ? 'var(--warning)' : 'var(--danger)'}"></div></div>
      <div class="gauge-details"><span>✅ No prazo: ${slaResOk}</span><span>❌ Estourado: ${slaResBreach}</span></div>
    </div>
    <div class="gauge-card">
      <h3>SLA de 1ª Resposta</h3>
      <div class="gauge-value" style="color: ${slaRespRate >= 80 ? 'var(--success)' : slaRespRate >= 60 ? 'var(--warning)' : 'var(--danger)'}">${slaRespRate}%</div>
      <div class="gauge-label">respondidas dentro do SLA</div>
      <div class="gauge-bar"><div class="gauge-fill" style="width: ${slaRespRate}%; background: ${slaRespRate >= 80 ? 'var(--success)' : slaRespRate >= 60 ? 'var(--warning)' : 'var(--danger)'}"></div></div>
      <div class="gauge-details"><span>✅ No prazo: ${slaRespOk}</span><span>❌ Atrasada: ${slaRespBreach}</span></div>
    </div>
  </div>

  <!-- Charts Row 1 -->
  <div class="charts-grid">
    <div class="chart-card">
      <h3>Distribuição por Status</h3>
      <canvas id="statusChart"></canvas>
    </div>
    <div class="chart-card">
      <h3>Distribuição por Prioridade</h3>
      <canvas id="priorityChart"></canvas>
    </div>
  </div>

  <!-- Charts Row 2 -->
  <div class="charts-grid">
    <div class="chart-card">
      <h3>Timeline de Demandas</h3>
      <canvas id="timelineChart"></canvas>
    </div>
    <div class="chart-card">
      <h3>SLA por Prioridade</h3>
      <canvas id="slaPriorityChart"></canvas>
    </div>
  </div>

  <!-- Charts Row 3 -->
  <div class="charts-grid">
    <div class="chart-card">
      <h3>Demandas por Cliente</h3>
      <canvas id="clientChart"></canvas>
    </div>
    <div class="chart-card">
      <h3>Carga por Responsável</h3>
      <canvas id="assigneeChart"></canvas>
    </div>
  </div>

  <!-- Charts Row 4 -->
  <div class="charts-grid">
    <div class="chart-card">
      <h3>Tipo de Demanda</h3>
      <canvas id="typeChart"></canvas>
    </div>
    <div class="chart-card">
      <h3>Categorias (Top 10)</h3>
      <canvas id="categoryChart"></canvas>
    </div>
  </div>

  <!-- Table -->
  <div class="table-section">
    <div class="table-header">
      <h2>Detalhamento das Demandas</h2>
      <div class="table-controls">
        <input type="text" class="table-search" id="tableSearch" placeholder="Buscar demanda, cliente, responsável...">
        <button class="table-filter-btn active" onclick="filterTable('all')">Todas</button>
        <button class="table-filter-btn" onclick="filterTable('aberta')">Abertas</button>
        <button class="table-filter-btn" onclick="filterTable('concluida')">Concluídas</button>
        <button class="table-filter-btn" onclick="filterTable('expirada')">Expiradas</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th onclick="sortTable(0)">Demanda ↕</th>
            <th onclick="sortTable(1)">Cliente ↕</th>
            <th onclick="sortTable(2)">Prior. ↕</th>
            <th onclick="sortTable(3)">Status ↕</th>
            <th onclick="sortTable(4)">Responsável ↕</th>
            <th onclick="sortTable(5)">Criação ↕</th>
            <th onclick="sortTable(6)">1ª Resp. ↕</th>
            <th onclick="sortTable(7)">Resolução ↕</th>
            <th onclick="sortTable(8)">Msgs ↕</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          ${tableRows}
        </tbody>
      </table>
      <div class="pagination">
        <span id="pageInfo"></span>
        <div>
          <button onclick="changePage(-1)" id="prevBtn">← Anterior</button>
          <button onclick="changePage(1)" id="nextBtn">Próximo →</button>
        </div>
      </div>
    </div>
  </div>

</div>

<div class="footer">
  Relatório gerado automaticamente por <a href="https://www.wearejust.it" target="_blank"><strong>${escapeHtml(brandName)}</strong></a> &middot; ${now.getFullYear()}
  <br>Os dados refletem o momento da exportação e podem ter sido atualizados desde então.
</div>

<script>
// Theme toggle
function toggleTheme() {
  const body = document.body;
  const isDark = body.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  body.setAttribute('data-theme', newTheme);
  document.getElementById('themeIcon').textContent = isDark ? '🌙' : '☀️';
  document.getElementById('themeLabel').textContent = isDark ? 'Tema Escuro' : 'Tema Claro';
  updateChartColors(newTheme);
}

function updateChartColors(theme) {
  const textColor = theme === 'light' ? '#475569' : '#94a3b8';
  const gridColor = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(42,58,78,0.5)';
  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;
  Object.values(Chart.instances).forEach(chart => {
    if (chart.options.scales) {
      Object.values(chart.options.scales).forEach(scale => {
        if (scale.grid) scale.grid.color = gridColor;
        if (scale.ticks) scale.ticks.color = textColor;
      });
    }
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = textColor;
    }
    chart.update();
  });
}

// Chart.js defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(42,58,78,0.5)';
Chart.defaults.font.family = "'Segoe UI', sans-serif";

// Status Doughnut
new Chart(document.getElementById('statusChart'), {
  type: 'doughnut',
  data: {
    labels: ['Aberta', 'Em Andamento', 'Concluída', 'Expirada'],
    datasets: [{
      data: [${statusData.aberta}, ${statusData.em_andamento}, ${statusData.concluida}, ${statusData.expirada}],
      backgroundColor: ['#3b82f6', '#a855f7', '#22c55e', '#ef4444'],
      borderWidth: 0,
      spacing: 3,
      borderRadius: 4,
    }]
  },
  options: {
    responsive: true,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 } }
    }
  }
});

// Priority Bar
new Chart(document.getElementById('priorityChart'), {
  type: 'bar',
  data: {
    labels: ['P1 Crítico', 'P2 Alta', 'P3 Média', 'Sem Classif.'],
    datasets: [{
      data: [${priorityData.p1}, ${priorityData.p2}, ${priorityData.p3}, ${priorityData.sem}],
      backgroundColor: ['#ef4444', '#f59e0b', '#06b6d4', '#64748b'],
      borderRadius: 6,
      borderSkipped: false,
    }]
  },
  options: {
    responsive: true,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
  }
});

// Timeline
new Chart(document.getElementById('timelineChart'), {
  type: 'line',
  data: {
    labels: [${timelineDays.map((d) => `'${d.slice(5)}'`).join(",")}],
    datasets: [
      { label: 'Criadas', data: [${timelineDays.map((d) => timelineMap[d].criadas).join(",")}], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6' },
      { label: 'Concluídas', data: [${timelineDays.map((d) => timelineMap[d].concluidas).join(",")}], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#22c55e' },
    ]
  },
  options: {
    responsive: true,
    interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } }
  }
});

// SLA by Priority
new Chart(document.getElementById('slaPriorityChart'), {
  type: 'bar',
  data: {
    labels: ['P1 Crítico', 'P2 Alta', 'P3 Média'],
    datasets: [
      { label: 'No prazo', data: [${slaPriorityData.p1.ok}, ${slaPriorityData.p2.ok}, ${slaPriorityData.p3.ok}], backgroundColor: '#22c55e', borderRadius: 4 },
      { label: 'Estourado', data: [${slaPriorityData.p1.breach}, ${slaPriorityData.p2.breach}, ${slaPriorityData.p3.breach}], backgroundColor: '#ef4444', borderRadius: 4 },
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }
  }
});

// Client Chart
new Chart(document.getElementById('clientChart'), {
  type: 'bar',
  data: {
    labels: [${clientEntries.map(([c]) => `'${c}'`).join(",")}],
    datasets: [
      { label: 'Abertas', data: [${clientEntries.map(([, v]) => v.aberta).join(",")}], backgroundColor: '#3b82f6', borderRadius: 4 },
      { label: 'Concluídas', data: [${clientEntries.map(([, v]) => v.concluida).join(",")}], backgroundColor: '#22c55e', borderRadius: 4 },
      { label: 'Expiradas', data: [${clientEntries.map(([, v]) => v.expirada).join(",")}], backgroundColor: '#ef4444', borderRadius: 4 },
    ]
  },
  options: {
    responsive: true,
    indexAxis: 'y',
    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { display: false } } }
  }
});

// Assignee Chart
new Chart(document.getElementById('assigneeChart'), {
  type: 'bar',
  data: {
    labels: [${assigneeEntries.map(([n]) => `'${n.split(" ")[0]}'`).join(",")}],
    datasets: [
      { label: 'Abertas', data: [${assigneeEntries.map(([, v]) => v.aberta).join(",")}], backgroundColor: '#3b82f6', borderRadius: 4 },
      { label: 'Concluídas', data: [${assigneeEntries.map(([, v]) => v.concluida).join(",")}], backgroundColor: '#22c55e', borderRadius: 4 },
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }
  }
});

// Type Chart
new Chart(document.getElementById('typeChart'), {
  type: 'doughnut',
  data: {
    labels: [${typeEntries.map(([t]) => `'${t}'`).join(",")}],
    datasets: [{
      data: [${typeEntries.map(([, v]) => v).join(",")}],
      backgroundColor: ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#06b6d4'],
      borderWidth: 0,
      spacing: 3,
      borderRadius: 4,
    }]
  },
  options: {
    responsive: true,
    cutout: '60%',
    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 } } }
  }
});

// Category Chart
new Chart(document.getElementById('categoryChart'), {
  type: 'bar',
  data: {
    labels: [${categoryEntries.map(([c]) => `'${c.slice(0, 20)}'`).join(",")}],
    datasets: [{
      data: [${categoryEntries.map(([, v]) => v).join(",")}],
      backgroundColor: '#60a5fa',
      borderRadius: 6,
      borderSkipped: false,
    }]
  },
  options: {
    responsive: true,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
  }
});

// Table interaction
const PAGE_SIZE = 25;
let currentPage = 0;
let currentFilter = 'all';
let currentSearch = '';

function getVisibleRows() {
  const rows = Array.from(document.querySelectorAll('#tableBody .table-row'));
  return rows.filter(r => {
    const matchFilter = currentFilter === 'all' || r.dataset.status === currentFilter || (currentFilter === 'aberta' && (r.dataset.status === 'aberta' || r.dataset.status === 'em_andamento'));
    const matchSearch = !currentSearch || r.textContent.toLowerCase().includes(currentSearch);
    return matchFilter && matchSearch;
  });
}

function renderTable() {
  const rows = Array.from(document.querySelectorAll('#tableBody .table-row'));
  const visible = getVisibleRows();
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  rows.forEach(r => r.classList.add('hidden'));
  visible.forEach((r, i) => { if (i >= start && i < end) r.classList.remove('hidden'); });

  document.getElementById('pageInfo').textContent = visible.length + ' demandas' + (visible.length !== rows.length ? ' (filtradas)' : '') + ' — Página ' + (currentPage + 1) + ' de ' + Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  document.getElementById('prevBtn').disabled = currentPage === 0;
  document.getElementById('nextBtn').disabled = end >= visible.length;
}

function filterTable(status) {
  currentFilter = status;
  currentPage = 0;
  document.querySelectorAll('.table-filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderTable();
}

function changePage(dir) {
  currentPage += dir;
  renderTable();
}

document.getElementById('tableSearch').addEventListener('input', function() {
  currentSearch = this.value.toLowerCase();
  currentPage = 0;
  renderTable();
});

// Sort table
let sortCol = -1, sortAsc = true;
function sortTable(col) {
  const tbody = document.getElementById('tableBody');
  const rows = Array.from(tbody.querySelectorAll('.table-row'));
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  rows.sort((a, b) => {
    const at = a.children[col].textContent.trim();
    const bt = b.children[col].textContent.trim();
    const cmp = at.localeCompare(bt, 'pt-BR', { numeric: true });
    return sortAsc ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
  renderTable();
}

renderTable();
</script>
</body>
</html>`;
}
