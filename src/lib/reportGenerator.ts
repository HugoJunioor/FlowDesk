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

function isSlaBreachedDemand(d: SlackDemand): boolean {
  if (d.slaResolutionStatus) return d.slaResolutionStatus === "expirado";
  if (d.priority === "sem_classificacao") return false;
  const cfg = PRIORITY_CONFIG[d.priority];
  if (!cfg?.sla) return false;
  if (d.status === "concluida" && d.completedAt) {
    return getResolutionMinutes(d.createdAt, d.completedAt)! > cfg.sla.resolutionHours * 60;
  }
  return d.status === "expirada";
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

    // Resolution SLA: dados históricos usam APENAS campo armazenado; abril+ calcula dinamicamente
    if (d.slaResolutionStatus === "atendido") {
      slaResOk++;
    } else if (d.slaResolutionStatus === "expirado") {
      slaResBreach++;
    } else {
      // Sem status armazenado: cálculo dinâmico para demandas em tempo real
      const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
      if (resMins !== null) {
        if (resMins <= cfg.sla.resolutionHours * 60) slaResOk++;
        else slaResBreach++;
      } else if (d.status === "expirada") {
        slaResBreach++;
      }
    }

    // First response SLA (exclui conciliação e remessa SITEF)
    if (!isExcludedFromFirstResponseSla(d)) {
      const frMins = getFirstResponseMinutes(d.createdAt, d.threadReplies, d.slaFirstResponse);
      if (frMins !== null) {
        totalFirstResp++;
        sumFirstResp += frMins;
        const slaRespMins = parseResponseSla(cfg.sla.response);
        if (frMins <= slaRespMins) slaRespOk++;
        else slaRespBreach++;
      } else if (d.slaResolutionStatus === "atendido" || d.slaResolutionStatus === "expirado") {
        // Dados históricos sem registro de resposta: conta como violação (sem resposta = atraso)
        slaRespBreach++;
      }
    }
  }

  const avgFirstResp = totalFirstResp > 0 ? sumFirstResp / totalFirstResp : 0;
  // Count of SLA-breached demands (for the table button badge, includes concluídas)
  const slaBreachedCount = demands.filter((d) => isSlaBreachedDemand(d)).length;
  const slaResRate = withSla.length > 0 ? Math.floor((slaResOk / withSla.length) * 100) : 0;
  const slaRespRate = slaRespOk + slaRespBreach > 0 ? Math.floor((slaRespOk / (slaRespOk + slaRespBreach)) * 100) : 0;

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

  // SLA per priority: usa slaResolutionStatus (historico) ou calcula em runtime (abril+)
  const slaPriorityData: Record<string, { ok: number; breach: number }> = { p1: { ok: 0, breach: 0 }, p2: { ok: 0, breach: 0 }, p3: { ok: 0, breach: 0 } };
  for (const d of withSla) {
    const cfg = PRIORITY_CONFIG[d.priority];
    if (!cfg?.sla || !slaPriorityData[d.priority]) continue;
    if (d.slaResolutionStatus) {
      if (d.slaResolutionStatus === "atendido") slaPriorityData[d.priority].ok++;
      else if (d.slaResolutionStatus === "expirado") slaPriorityData[d.priority].breach++;
    } else {
      const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
      if (resMins !== null) {
        if (resMins <= cfg.sla.resolutionHours * 60) slaPriorityData[d.priority].ok++;
        else slaPriorityData[d.priority].breach++;
      } else if (d.status === "expirada") {
        slaPriorityData[d.priority].breach++;
      }
    }
  }

  // === SECTION DATA: Month helpers ===
  const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function monthKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function monthLabel(key: string): string {
    const [yr, mo] = key.split("-");
    return `${MONTHS_PT[parseInt(mo, 10) - 1]}/${yr.slice(2)}`;
  }

  // Section 1: SLA Resolução by month
  const monthlyResMap: Record<string, { atendido: number; expirado: number; totalResHours: number; countRes: number }> = {};
  for (const d of withSla) {
    const key = monthKey(d.createdAt);
    if (!monthlyResMap[key]) monthlyResMap[key] = { atendido: 0, expirado: 0, totalResHours: 0, countRes: 0 };
    const cfg = PRIORITY_CONFIG[d.priority];
    if (!cfg?.sla) continue;
    // Resolution status
    let resStatus: "atendido" | "expirado" | null = null;
    if (d.slaResolutionStatus === "atendido") resStatus = "atendido";
    else if (d.slaResolutionStatus === "expirado") resStatus = "expirado";
    else {
      const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
      if (resMins !== null) resStatus = resMins <= cfg.sla.resolutionHours * 60 ? "atendido" : "expirado";
      else if (d.status === "expirada") resStatus = "expirado";
    }
    if (resStatus === "atendido") monthlyResMap[key].atendido++;
    else if (resStatus === "expirado") monthlyResMap[key].expirado++;
    // Avg resolution hours
    const rh = d.resolutionHours ?? (getResolutionMinutes(d.createdAt, d.completedAt) !== null ? (getResolutionMinutes(d.createdAt, d.completedAt) as number) / 60 : null);
    if (rh !== null) {
      monthlyResMap[key].totalResHours += rh;
      monthlyResMap[key].countRes++;
    }
  }
  const monthlyResKeys = Object.keys(monthlyResMap).sort();
  const monthlyResData = {
    labels: monthlyResKeys.map(monthLabel),
    atendido: monthlyResKeys.map((k) => monthlyResMap[k].atendido),
    expirado: monthlyResKeys.map((k) => monthlyResMap[k].expirado),
    avgHours: monthlyResKeys.map((k) => monthlyResMap[k].countRes > 0 ? Math.round((monthlyResMap[k].totalResHours / monthlyResMap[k].countRes) * 10) / 10 : 0),
  };
  const totalResAtendido = slaResOk;
  const totalResExpirado = slaResBreach;

  // Section 2: SLA Atendimento (1ª Resposta) by month
  const monthlyRespMap: Record<string, { atendido: number; expirado: number; totalRespMins: number; countResp: number }> = {};
  for (const d of withSla) {
    const cfg = PRIORITY_CONFIG[d.priority];
    if (!cfg?.sla) continue;
    if (isExcludedFromFirstResponseSla(d)) continue;
    const frMins = getFirstResponseMinutes(d.createdAt, d.threadReplies, d.slaFirstResponse);
    if (frMins === null) continue;
    const key = monthKey(d.createdAt);
    if (!monthlyRespMap[key]) monthlyRespMap[key] = { atendido: 0, expirado: 0, totalRespMins: 0, countResp: 0 };
    const slaRespMins = parseResponseSla(cfg.sla.response);
    if (frMins <= slaRespMins) monthlyRespMap[key].atendido++;
    else monthlyRespMap[key].expirado++;
    monthlyRespMap[key].totalRespMins += frMins;
    monthlyRespMap[key].countResp++;
  }
  const monthlyRespKeys = Object.keys(monthlyRespMap).sort();
  const monthlyRespData = {
    labels: monthlyRespKeys.map(monthLabel),
    atendido: monthlyRespKeys.map((k) => monthlyRespMap[k].atendido),
    expirado: monthlyRespKeys.map((k) => monthlyRespMap[k].expirado),
    avgMins: monthlyRespKeys.map((k) => monthlyRespMap[k].countResp > 0 ? Math.round(monthlyRespMap[k].totalRespMins / monthlyRespMap[k].countResp) : 0),
  };

  // Section 3: Tipo de Demanda
  const demandTypeCategories: Record<string, "bug" | "tarefa"> = {};
  function demandTypeGroup(t: string): "bug" | "tarefa" {
    return t === "Problema/Bug" ? "bug" : "tarefa";
  }
  // By month
  const typeMonthMap: Record<string, { bug: number; tarefa: number }> = {};
  for (const d of demands) {
    const key = monthKey(d.createdAt);
    if (!typeMonthMap[key]) typeMonthMap[key] = { bug: 0, tarefa: 0 };
    demandTypeCategories[d.demandType] = demandTypeGroup(d.demandType);
    typeMonthMap[key][demandTypeGroup(d.demandType)]++;
  }
  const typeMonthKeys = Object.keys(typeMonthMap).sort();
  const typeMonthData = {
    labels: typeMonthKeys.map(monthLabel),
    bug: typeMonthKeys.map((k) => typeMonthMap[k].bug),
    tarefa: typeMonthKeys.map((k) => typeMonthMap[k].tarefa),
  };
  // By requester (top 10)
  const typeRequesterMap: Record<string, { bug: number; tarefa: number }> = {};
  for (const d of demands) {
    const req = d.requester?.name || "Desconhecido";
    if (!typeRequesterMap[req]) typeRequesterMap[req] = { bug: 0, tarefa: 0 };
    typeRequesterMap[req][demandTypeGroup(d.demandType)]++;
  }
  const typeRequesterEntries = Object.entries(typeRequesterMap)
    .sort((a, b) => (b[1].bug + b[1].tarefa) - (a[1].bug + a[1].tarefa))
    .slice(0, 10);
  const typeRequesterData = {
    labels: typeRequesterEntries.map(([n]) => n.split(" ")[0]),
    bug: typeRequesterEntries.map(([, v]) => v.bug),
    tarefa: typeRequesterEntries.map(([, v]) => v.tarefa),
  };
  // Pie totals
  const totalBug = demands.filter((d) => d.demandType === "Problema/Bug").length;
  const totalTarefa = demands.length - totalBug;

  // Section 4: Análise por Cliente
  // Priority by month (all clients)
  const prioMonthMap: Record<string, { p1: number; p2: number; p3: number }> = {};
  for (const d of demands) {
    const key = monthKey(d.createdAt);
    if (!prioMonthMap[key]) prioMonthMap[key] = { p1: 0, p2: 0, p3: 0 };
    if (d.priority === "p1") prioMonthMap[key].p1++;
    else if (d.priority === "p2") prioMonthMap[key].p2++;
    else if (d.priority === "p3") prioMonthMap[key].p3++;
  }
  const prioMonthKeys = Object.keys(prioMonthMap).sort();
  const prioMonthData = {
    labels: prioMonthKeys.map(monthLabel),
    p1: prioMonthKeys.map((k) => prioMonthMap[k].p1),
    p2: prioMonthKeys.map((k) => prioMonthMap[k].p2),
    p3: prioMonthKeys.map((k) => prioMonthMap[k].p3),
  };
  // By requester top 10
  const reqMap: Record<string, number> = {};
  for (const d of demands) {
    const req = d.requester?.name || "Desconhecido";
    reqMap[req] = (reqMap[req] || 0) + 1;
  }
  const reqEntries = Object.entries(reqMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const reqData = {
    labels: reqEntries.map(([n]) => n.split(" ")[0]),
    values: reqEntries.map(([, v]) => v),
  };

  // Section 5: Análise Geral
  // Stacked by client per month (top 6 clients)
  const CLIENT_PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#f97316"];
  const top6Clients = clientEntries.slice(0, 6).map(([c]) => c);
  const clientMonthMap: Record<string, Record<string, number>> = {};
  for (const d of demands) {
    const key = monthKey(d.createdAt);
    const client = extractClientName(d.slackChannel);
    if (!clientMonthMap[key]) clientMonthMap[key] = {};
    clientMonthMap[key][client] = (clientMonthMap[key][client] || 0) + 1;
  }
  const clientMonthKeys = Object.keys(clientMonthMap).sort();
  const clientMonthData = {
    labels: clientMonthKeys.map(monthLabel),
    clients: top6Clients,
    series: top6Clients.map((c) => clientMonthKeys.map((k) => clientMonthMap[k]?.[c] || 0)),
    colors: CLIENT_PALETTE,
  };
  // Priority distribution per client (top 6)
  const clientPrioMap: Record<string, { p1: number; p2: number; p3: number }> = {};
  for (const d of demands) {
    const client = extractClientName(d.slackChannel);
    if (!clientPrioMap[client]) clientPrioMap[client] = { p1: 0, p2: 0, p3: 0 };
    if (d.priority === "p1") clientPrioMap[client].p1++;
    else if (d.priority === "p2") clientPrioMap[client].p2++;
    else if (d.priority === "p3") clientPrioMap[client].p3++;
  }
  const clientPrioData = {
    labels: top6Clients,
    p1: top6Clients.map((c) => clientPrioMap[c]?.p1 || 0),
    p2: top6Clients.map((c) => clientPrioMap[c]?.p2 || 0),
    p3: top6Clients.map((c) => clientPrioMap[c]?.p3 || 0),
  };
  // Type per client (top 6)
  const clientTypeMap: Record<string, { bug: number; tarefa: number }> = {};
  for (const d of demands) {
    const client = extractClientName(d.slackChannel);
    if (!clientTypeMap[client]) clientTypeMap[client] = { bug: 0, tarefa: 0 };
    clientTypeMap[client][demandTypeGroup(d.demandType)]++;
  }
  const clientTypeData = {
    labels: top6Clients,
    bug: top6Clients.map((c) => clientTypeMap[c]?.bug || 0),
    tarefa: top6Clients.map((c) => clientTypeMap[c]?.tarefa || 0),
  };

  // Avg resolution time and first response by priority (dynamic: computes for demands lacking stored values)
  const prioAvgData = (() => {
    const PRIOS = ["p1", "p2", "p3"] as const;
    const result: { label: string; avgRes: number; avgResp: number; slaRes: number; slaResp: number; count: number }[] = [];
    const PRIO_LABELS: Record<string, string> = { p1: "P1 - Crítico", p2: "P2 - Alta", p3: "P3 - Média" };
    const PRIO_SLA_RES: Record<string, number> = { p1: 4, p2: 8, p3: 24 };
    const PRIO_SLA_RESP: Record<string, number> = { p1: 15/60, p2: 1, p3: 4 }; // in hours

    for (const p of PRIOS) {
      const pDemands = demands.filter(d => d.priority === p);

      // Resolution: use stored value if available, otherwise compute from timestamps
      const resHoursArr = pDemands
        .map(d => {
          if (d.resolutionHours != null && d.resolutionHours > 0) return d.resolutionHours;
          const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
          return resMins != null && resMins > 0 ? resMins / 60 : null;
        })
        .filter((h): h is number => h !== null);
      const avgRes = resHoursArr.length > 0
        ? Math.round((resHoursArr.reduce((s, h) => s + h, 0) / resHoursArr.length) * 10) / 10
        : 0;

      // First response: use stored value or compute from threadReplies
      const firstRespMinsArr = pDemands
        .map(d => getFirstResponseMinutes(d.createdAt, d.threadReplies, d.slaFirstResponse))
        .filter((m): m is number => m !== null && m > 0);
      const avgRespMins = firstRespMinsArr.length > 0
        ? Math.round(firstRespMinsArr.reduce((s, m) => s + m, 0) / firstRespMinsArr.length)
        : 0;
      const avgRespHours = Math.round((avgRespMins / 60) * 10) / 10;

      result.push({
        label: PRIO_LABELS[p],
        avgRes,
        avgResp: avgRespHours,
        slaRes: PRIO_SLA_RES[p],
        slaResp: PRIO_SLA_RESP[p],
        count: pDemands.length,
      });
    }
    return result;
  })();
  const prioAvgJson = JSON.stringify(prioAvgData);

  // Serialize all section data for embedding in HTML
  const secDataJson = JSON.stringify({
    monthlyRes: monthlyResData,
    totalResAtendido,
    totalResExpirado,
    monthlyResp: monthlyRespData,
    totalRespAtendido: slaRespOk,
    totalRespExpirado: slaRespBreach,
    typeMonth: typeMonthData,
    typeRequester: typeRequesterData,
    totalBug,
    totalTarefa,
    prioMonth: prioMonthData,
    req: reqData,
    priorityTotals: { p1: p1Count, p2: p2Count, p3: p3Count },
    clientMonth: clientMonthData,
    clientPrio: clientPrioData,
    clientType: clientTypeData,
  });

  // === Timeline: aggregate to months for annual view ===
  const isAnnualPeriod = /^\d{4}$/.test(filters?.["Período"] || "");
  let tLabels: string, tCriadas: string, tConcluidas: string;
  if (isAnnualPeriod) {
    const mAgg: Record<string, { c: number; co: number }> = {};
    for (const day of timelineDays) {
      const mk = day.slice(0, 7);
      if (!mAgg[mk]) mAgg[mk] = { c: 0, co: 0 };
      mAgg[mk].c += timelineMap[day].criadas;
      mAgg[mk].co += timelineMap[day].concluidas;
    }
    const mKeys = Object.keys(mAgg).sort();
    tLabels = mKeys.map((k) => `'${monthLabel(k)}'`).join(",");
    tCriadas = mKeys.map((k) => mAgg[k].c).join(",");
    tConcluidas = mKeys.map((k) => mAgg[k].co).join(",");
  } else {
    tLabels = timelineDays.map((d) => `'${d.slice(5)}'`).join(",");
    tCriadas = timelineDays.map((d) => timelineMap[d].criadas).join(",");
    tConcluidas = timelineDays.map((d) => timelineMap[d].concluidas).join(",");
  }

  // === Período display for filter panel ===
  const periodoDisplay = (() => {
    const p = filters?.["Período"];
    if (!p) return "Todo o histórico";
    const labels: Record<string, string> = {
      hoje: "Diário (Hoje)", semanal: "Semanal", mensal: "Mensal",
    };
    if (labels[p]) return labels[p];
    if (/^\d{4}$/.test(p)) return `Anual (${p})`;
    return p; // personalizado: e.g. "Jan/2025"
  })();

  // === Filter description ===
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
      const frMins = getFirstResponseMinutes(d.createdAt, d.threadReplies, d.slaFirstResponse);
      const resMins = getResolutionMinutes(d.createdAt, d.completedAt);
      const cfg = PRIORITY_CONFIG[d.priority];
      const slaRespLimit = cfg?.sla ? parseResponseSla(cfg.sla.response) : null;
      const slaResLimit = cfg?.sla ? cfg.sla.resolutionHours * 60 : null;

      const frStatus = frMins !== null && slaRespLimit !== null ? (frMins <= slaRespLimit ? "ok" : "breach") : "na";
      // Usa slaResolutionStatus da planilha (historico) ou calcula em runtime (abril+)
      const resStatus = d.slaResolutionStatus
        ? (d.slaResolutionStatus === "atendido" ? "ok" : "breach")
        : (resMins !== null && slaResLimit !== null ? (resMins <= slaResLimit ? "ok" : "breach") : "na");

      const priorityClass = d.priority === "p1" ? "priority-p1" : d.priority === "p2" ? "priority-p2" : d.priority === "p3" ? "priority-p3" : "priority-none";
      const statusClass = d.status === "concluida" ? "status-done" : d.status === "expirada" ? "status-expired" : d.status === "em_andamento" ? "status-progress" : "status-open";

      const isSlaBreachRow = isSlaBreachedDemand(d) ? "breach" : "ok";
      return `<tr class="table-row" data-status="${d.status}" data-priority="${d.priority}" data-client="${escapeHtml(client.toLowerCase())}" data-sla="${isSlaBreachRow}">
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
    top: 12px;
    right: 12px;
    z-index: 100;
    background: none;
    border: 1.5px solid rgba(255,255,255,0.25);
    border-radius: 4px;
    width: 16px;
    height: 16px;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .theme-toggle:hover { border-color: rgba(255,255,255,0.6); }
  .theme-toggle .check { display: none; font-size: 10px; line-height: 1; color: var(--primary); }
  [data-theme="light"] .theme-toggle { border-color: var(--border); background: var(--primary); }
  [data-theme="light"] .theme-toggle .check { display: block; color: #fff; }
  [data-theme="light"] .theme-toggle:hover { opacity: 0.8; }

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

  /* Nav bar */
  .nav-bar {
    display: flex;
    gap: 0;
    padding: 0 24px;
    background: #1a2a42;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-wrap: wrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .nav-link {
    color: rgba(255,255,255,0.65);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    padding: 12px 16px;
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .nav-link:hover { color: #fff; border-bottom-color: var(--primary-light); }
  .nav-link.active { color: #fff; border-bottom-color: var(--primary); }

  /* Section pages */
  .section-page {
    padding: 32px 48px;
    margin-bottom: 40px;
  }
  .section-page:not(:first-child) { page-break-before: always; }
  .section-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 24px;
  }
  .section-divider {
    height: 1px;
    background: var(--border);
    margin-bottom: 24px;
  }

  /* 2x2 grid */
  .charts-grid-2x2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }

  /* Client analysis layout */
  .client-analysis-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  .filter-panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
  }
  .filter-panel h4 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-dim);
    margin-bottom: 16px;
  }
  .filter-item {
    margin-bottom: 12px;
  }
  .filter-item label {
    font-size: 11px;
    color: var(--text-dim);
    display: block;
    margin-bottom: 4px;
  }
  .filter-item span {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
  }
  .client-charts-area {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .client-charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  /* Print */
  @media print {
    body { background: #fff; color: #1a1a1a; }
    .header { background: #2563eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .kpi-card, .chart-card, .gauge-card, .table-wrap { border-color: #e2e8f0; background: #fff; }
    .table-controls, .pagination, .nav-bar { display: none; }
    .section-page { padding: 20px; }
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

<button class="theme-toggle" onclick="toggleTheme()" title="Alternar tema">
  <span class="check">✓</span>
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
    </div>
    ${filterDesc ? `<div class="filter-tags">${filterDesc}</div>` : ""}
  </div>
</div>

<nav class="nav-bar">
  <a href="#visao-geral" class="nav-link active" onclick="setActiveNav(this)">Visão Geral</a>
  <a href="#sla-resolucao" class="nav-link" onclick="setActiveNav(this)">SLA Resolução</a>
  <a href="#sla-atendimento" class="nav-link" onclick="setActiveNav(this)">SLA Atendimento</a>
  <a href="#tipo-demanda" class="nav-link" onclick="setActiveNav(this)">Tipo de Demanda</a>
  <a href="#analise-cliente" class="nav-link" onclick="setActiveNav(this)">Análise por Cliente</a>
  <a href="#analise-geral" class="nav-link" onclick="setActiveNav(this)">Análise Geral</a>
  <a href="#prio-avg" class="nav-link" onclick="setActiveNav(this)">Média por Prior.</a>
</nav>

<div id="visao-geral" class="container">

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
        <button class="table-filter-btn" onclick="filterTable('sla_breach')">SLA Estourado <span style="background:var(--danger);color:#fff;border-radius:10px;padding:1px 6px;font-size:11px;margin-left:4px">${slaBreachedCount}</span></button>
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

<!-- ===== SECTION 1: SLA de Resolução ===== -->
<div id="sla-resolucao" class="section-page">
  <div class="section-title">🛡️ SLA de Resolução</div>
  <div class="section-subtitle">Análise mensal do cumprimento de SLA de resolução das demandas classificadas</div>
  <div class="section-divider"></div>
  <div class="charts-grid-2x2">
    <div class="chart-card">
      <h3>Atendido vs Expirado por Mês</h3>
      <canvas id="slaResMonthBar" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>% Atendido / Expirado por Mês</h3>
      <canvas id="slaResMonthPct" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Total Geral — Atendido vs Expirado</h3>
      <canvas id="slaResPie" style="max-height:280px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Média de Tempo de Resolução (horas)</h3>
      <canvas id="slaResAvgLine" style="max-height:300px"></canvas>
    </div>
  </div>
</div>

<!-- ===== SECTION 2: SLA de Atendimento (1ª Resposta) ===== -->
<div id="sla-atendimento" class="section-page">
  <div class="section-title">⚡ SLA de Atendimento — 1ª Resposta</div>
  <div class="section-subtitle">Análise mensal do cumprimento de SLA de primeira resposta das demandas classificadas</div>
  <div class="section-divider"></div>
  <div class="charts-grid-2x2">
    <div class="chart-card">
      <h3>Atendido vs Expirado por Mês</h3>
      <canvas id="slaRespMonthBar" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>% Atendido / Expirado por Mês</h3>
      <canvas id="slaRespMonthPct" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Total Geral — Atendido vs Expirado</h3>
      <canvas id="slaRespPie" style="max-height:280px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Média de Tempo de 1ª Resposta (min)</h3>
      <canvas id="slaRespAvgLine" style="max-height:300px"></canvas>
    </div>
  </div>
</div>

<!-- ===== SECTION 3: Tipo de Demanda ===== -->
<div id="tipo-demanda" class="section-page">
  <div class="section-title">🏷️ Tipo de Demanda</div>
  <div class="section-subtitle">Distribuição entre Problema/Bug e Tarefa/Ajuda ao longo do tempo e por solicitante</div>
  <div class="section-divider"></div>
  <div class="charts-grid-3">
    <div class="chart-card">
      <h3>Problema/Bug vs Tarefa/Ajuda por Mês</h3>
      <canvas id="typeMonthChart" style="max-height:320px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Por Solicitante (Top 10)</h3>
      <canvas id="typeRequesterChart" style="max-height:320px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Distribuição Total</h3>
      <canvas id="typePieChart" style="max-height:280px"></canvas>
    </div>
  </div>
</div>

<!-- ===== SECTION 4: Análise por Cliente ===== -->
<div id="analise-cliente" class="section-page">
  <div class="section-title">👥 Análise por Cliente</div>
  <div class="section-subtitle">Visão agregada de prioridades e abertura por cliente</div>
  <div class="section-divider"></div>
  <div class="client-analysis-layout">
    <div class="filter-panel">
      <h4>Filtros Aplicados</h4>
      <div class="filter-item">
        <label>Cliente</label>
        <span>Todos</span>
      </div>
      <div class="filter-item">
        <label>Período</label>
        <span>${escapeHtml(periodoDisplay)}</span>
      </div>
      <div class="filter-item">
        <label>Total de demandas</label>
        <span>${total}</span>
      </div>
      <div class="filter-item">
        <label>P1 Crítico</label>
        <span style="color: #ef4444; font-weight: 700">${p1Count}</span>
      </div>
      <div class="filter-item">
        <label>P2 Alta</label>
        <span style="color: #f59e0b; font-weight: 700">${p2Count}</span>
      </div>
      <div class="filter-item">
        <label>P3 Média</label>
        <span style="color: #06b6d4; font-weight: 700">${p3Count}</span>
      </div>
    </div>
    <div class="client-charts-area">
      <div class="client-charts-row">
        <div class="chart-card">
          <h3>Prioridade por Mês (P1/P2/P3)</h3>
          <canvas id="prioMonthChart" style="max-height:280px"></canvas>
        </div>
        <div class="chart-card">
          <h3>Distribuição de Prioridade (Total)</h3>
          <canvas id="prioPieChart" style="max-height:280px"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>Abertura por Solicitante (Top 10)</h3>
        <canvas id="reqBarChart" style="max-height:240px"></canvas>
      </div>
    </div>
  </div>
</div>

<!-- ===== SECTION 5: Análise Geral ===== -->
<div id="analise-geral" class="section-page">
  <div class="section-title">📊 Análise Geral</div>
  <div class="section-subtitle">Visão consolidada por cliente: volume mensal, prioridade e tipo de demanda</div>
  <div class="section-divider"></div>
  <div class="charts-grid-2x2">
    <div class="chart-card">
      <h3>Volume por Mês — Top 6 Clientes</h3>
      <canvas id="generalMonthClient" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Distribuição P1/P2/P3 por Cliente</h3>
      <canvas id="generalClientPrio" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Problema/Bug vs Tarefa/Ajuda por Cliente</h3>
      <canvas id="generalClientType" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Total de Demandas por Cliente (Top 6)</h3>
      <canvas id="generalClientTotal" style="max-height:300px"></canvas>
    </div>
  </div>
</div>

<!-- ===== SECTION 6: Média de Tempo por Prioridade ===== -->
<div id="prio-avg" class="section-page">
  <div class="section-title">⏱️ Média de Tempo por Prioridade</div>
  <div class="section-subtitle">Tempo médio de resolução e primeira resposta por nível de prioridade</div>
  <div class="section-divider"></div>
  <div class="charts-grid-2x2">
    <div class="chart-card">
      <h3>Média de Tempo de Resolução por Prioridade</h3>
      <canvas id="prioAvgResChart" style="max-height:300px"></canvas>
    </div>
    <div class="chart-card">
      <h3>Média de Tempo de 1ª Resposta por Prioridade</h3>
      <canvas id="prioAvgRespChart" style="max-height:300px"></canvas>
    </div>
  </div>
  <div id="prioAvgCards" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;"></div>
</div>

<div class="footer">
  Relatório gerado automaticamente por <strong>${escapeHtml(brandName)}</strong> &middot; ${now.getFullYear()}
  <br>Os dados refletem o momento da exportação e podem ter sido atualizados desde então.
</div>

<script>
// ===== EMBEDDED SECTION DATA =====
const SEC = ${secDataJson};
const PRIO_AVG = ${prioAvgJson};

// ===== TIME FORMATTERS =====
function fmtH(h) {
  if (!h && h !== 0) return '—';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return hours + 'h ' + mins + 'min';
  if (hours > 0) return hours + 'h';
  return mins + 'min';
}
function fmtMins(m) {
  if (!m && m !== 0) return '—';
  const h = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  if (h > 0 && mins > 0) return h + 'h ' + mins + 'min';
  if (h > 0) return h + 'h';
  return mins + 'min';
}

// ===== NAV ACTIVE STATE =====
function setActiveNav(el) {
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
}

// ===== CHART HELPERS =====
function pct100Datasets(atendidoArr, expiradoArr, colors) {
  return atendidoArr.map((a, i) => {
    const total = a + expiradoArr[i];
    return total === 0 ? [0, 0] : [Math.round(a / total * 100), Math.round(expiradoArr[i] / total * 100)];
  }).reduce((acc, pair) => { acc[0].push(pair[0]); acc[1].push(pair[1]); return acc; }, [[], []]);
}

// ===== Theme toggle =====
function toggleTheme() {
  const body = document.body;
  const isDark = body.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  body.setAttribute('data-theme', newTheme);
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
    labels: ['P1 Crítico', 'P2 Alta', 'P3 Média'],
    datasets: [{
      data: [${priorityData.p1}, ${priorityData.p2}, ${priorityData.p3}],
      backgroundColor: ['#ef4444', '#f59e0b', '#06b6d4'],
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

// Timeline (daily or monthly when annual)
new Chart(document.getElementById('timelineChart'), {
  type: 'line',
  data: {
    labels: [${tLabels}],
    datasets: [
      { label: 'Criadas', data: [${tCriadas}], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6' },
      { label: 'Concluídas', data: [${tConcluidas}], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#22c55e' },
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
      { label: 'No prazo', data: [${slaPriorityData.p1.ok}, ${slaPriorityData.p2.ok}, ${slaPriorityData.p3.ok}], backgroundColor: '#22c55e', borderRadius: 4, maxBarThickness: 60, barPercentage: 0.8, categoryPercentage: 0.6 },
      { label: 'Estourado', data: [${slaPriorityData.p1.breach}, ${slaPriorityData.p2.breach}, ${slaPriorityData.p3.breach}], backgroundColor: '#ef4444', borderRadius: 4, maxBarThickness: 60, barPercentage: 0.8, categoryPercentage: 0.6 },
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { display: false }, ticks: { stepSize: 1 } } }
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

// ===== SECTION 1: SLA de Resolução =====
// 1a: Horizontal stacked bar by month (counts)
new Chart(document.getElementById('slaResMonthBar'), {
  type: 'bar',
  data: {
    labels: SEC.monthlyRes.labels,
    datasets: [
      { label: 'Atendido', data: SEC.monthlyRes.atendido, backgroundColor: '#22c55e', borderRadius: 4, stack: 's1' },
      { label: 'Expirado', data: SEC.monthlyRes.expirado, backgroundColor: '#ef4444', borderRadius: 4, stack: 's1' },
    ]
  },
  options: {
    responsive: true, indexAxis: 'y',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
      datalabels: { display: false }
    },
    scales: {
      x: { stacked: true, beginAtZero: true, grid: { display: false } },
      y: { stacked: true, grid: { display: false } }
    }
  }
});

// 1b: 100% stacked bar by month
(function() {
  const pairs = pct100Datasets(SEC.monthlyRes.atendido, SEC.monthlyRes.expirado);
  new Chart(document.getElementById('slaResMonthPct'), {
    type: 'bar',
    data: {
      labels: SEC.monthlyRes.labels,
      datasets: [
        { label: '% Atendido', data: pairs[0], backgroundColor: '#22c55e', borderRadius: 4, stack: 's2' },
        { label: '% Expirado', data: pairs[1], backgroundColor: '#ef4444', borderRadius: 4, stack: 's2' },
      ]
    },
    options: {
      responsive: true, indexAxis: 'y',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw + '%' } }
      },
      scales: {
        x: { stacked: true, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } },
        y: { stacked: true, grid: { display: false } }
      }
    }
  });
})();

// 1c: Pie total
new Chart(document.getElementById('slaResPie'), {
  type: 'doughnut',
  data: {
    labels: ['Atendido', 'Expirado'],
    datasets: [{ data: [SEC.totalResAtendido, SEC.totalResExpirado], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0, spacing: 3, borderRadius: 4 }]
  },
  options: {
    responsive: true, cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = SEC.totalResAtendido + SEC.totalResExpirado;
            const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0;
            return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
          }
        }
      }
    }
  }
});

// 1d: Avg resolution hours line
new Chart(document.getElementById('slaResAvgLine'), {
  type: 'line',
  data: {
    labels: SEC.monthlyRes.labels,
    datasets: [{ label: 'Média de Resolução (h)', data: SEC.monthlyRes.avgHours, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#3b82f6' }]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: 'rgba(42,58,78,0.3)' }, ticks: { callback: v => v + 'h' } }
    }
  }
});

// ===== SECTION 2: SLA de Atendimento =====
// 2a: Horizontal stacked bar by month (counts)
new Chart(document.getElementById('slaRespMonthBar'), {
  type: 'bar',
  data: {
    labels: SEC.monthlyResp.labels,
    datasets: [
      { label: 'Atendido', data: SEC.monthlyResp.atendido, backgroundColor: '#22c55e', borderRadius: 4, stack: 's3' },
      { label: 'Expirado', data: SEC.monthlyResp.expirado, backgroundColor: '#ef4444', borderRadius: 4, stack: 's3' },
    ]
  },
  options: {
    responsive: true, indexAxis: 'y',
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { stacked: true, beginAtZero: true, grid: { display: false } },
      y: { stacked: true, grid: { display: false } }
    }
  }
});

// 2b: 100% stacked
(function() {
  const pairs = pct100Datasets(SEC.monthlyResp.atendido, SEC.monthlyResp.expirado);
  new Chart(document.getElementById('slaRespMonthPct'), {
    type: 'bar',
    data: {
      labels: SEC.monthlyResp.labels,
      datasets: [
        { label: '% Atendido', data: pairs[0], backgroundColor: '#22c55e', borderRadius: 4, stack: 's4' },
        { label: '% Expirado', data: pairs[1], backgroundColor: '#ef4444', borderRadius: 4, stack: 's4' },
      ]
    },
    options: {
      responsive: true, indexAxis: 'y',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw + '%' } }
      },
      scales: {
        x: { stacked: true, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } },
        y: { stacked: true, grid: { display: false } }
      }
    }
  });
})();

// 2c: Pie total
new Chart(document.getElementById('slaRespPie'), {
  type: 'doughnut',
  data: {
    labels: ['Atendido', 'Expirado'],
    datasets: [{ data: [SEC.totalRespAtendido, SEC.totalRespExpirado], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0, spacing: 3, borderRadius: 4 }]
  },
  options: {
    responsive: true, cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = SEC.totalRespAtendido + SEC.totalRespExpirado;
            const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0;
            return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
          }
        }
      }
    }
  }
});

// 2d: Avg response min line
new Chart(document.getElementById('slaRespAvgLine'), {
  type: 'line',
  data: {
    labels: SEC.monthlyResp.labels,
    datasets: [{ label: 'Média 1ª Resposta (min)', data: SEC.monthlyResp.avgMins, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#f59e0b' }]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: 'rgba(42,58,78,0.3)' }, ticks: { callback: v => v + 'min' } }
    }
  }
});

// ===== SECTION 3: Tipo de Demanda =====
// 3a: Stacked bar by month
new Chart(document.getElementById('typeMonthChart'), {
  type: 'bar',
  data: {
    labels: SEC.typeMonth.labels,
    datasets: [
      { label: 'Problema/Bug', data: SEC.typeMonth.bug, backgroundColor: '#1e3a5f', borderRadius: 4, stack: 's5' },
      { label: 'Tarefa/Ajuda', data: SEC.typeMonth.tarefa, backgroundColor: '#f97316', borderRadius: 4, stack: 's5' },
    ]
  },
  options: {
    responsive: true, indexAxis: 'y',
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { stacked: true, beginAtZero: true, grid: { display: false } },
      y: { stacked: true, grid: { display: false } }
    }
  }
});

// 3b: By requester
new Chart(document.getElementById('typeRequesterChart'), {
  type: 'bar',
  data: {
    labels: SEC.typeRequester.labels,
    datasets: [
      { label: 'Problema/Bug', data: SEC.typeRequester.bug, backgroundColor: '#1e3a5f', borderRadius: 4, stack: 's6' },
      { label: 'Tarefa/Ajuda', data: SEC.typeRequester.tarefa, backgroundColor: '#f97316', borderRadius: 4, stack: 's6' },
    ]
  },
  options: {
    responsive: true, indexAxis: 'y',
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { stacked: true, beginAtZero: true, grid: { display: false } },
      y: { stacked: true, grid: { display: false } }
    }
  }
});

// 3c: Pie total
new Chart(document.getElementById('typePieChart'), {
  type: 'doughnut',
  data: {
    labels: ['Problema/Bug', 'Tarefa/Ajuda'],
    datasets: [{ data: [SEC.totalBug, SEC.totalTarefa], backgroundColor: ['#1e3a5f', '#f97316'], borderWidth: 0, spacing: 3, borderRadius: 4 }]
  },
  options: {
    responsive: true, cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = SEC.totalBug + SEC.totalTarefa;
            const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0;
            return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
          }
        }
      }
    }
  }
});

// ===== SECTION 4: Análise por Cliente =====
// 4a: Stacked bar priority by month
new Chart(document.getElementById('prioMonthChart'), {
  type: 'bar',
  data: {
    labels: SEC.prioMonth.labels,
    datasets: [
      { label: 'P1', data: SEC.prioMonth.p1, backgroundColor: '#ef4444', borderRadius: 4, stack: 's7', maxBarThickness: 60, barPercentage: 0.8, categoryPercentage: 0.6 },
      { label: 'P2', data: SEC.prioMonth.p2, backgroundColor: '#f59e0b', borderRadius: 4, stack: 's7', maxBarThickness: 60, barPercentage: 0.8, categoryPercentage: 0.6 },
      { label: 'P3', data: SEC.prioMonth.p3, backgroundColor: '#eab308', borderRadius: 4, stack: 's7', maxBarThickness: 60, barPercentage: 0.8, categoryPercentage: 0.6 },
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, grid: { display: false } }
    }
  }
});

// 4b: Priority pie
new Chart(document.getElementById('prioPieChart'), {
  type: 'doughnut',
  data: {
    labels: ['P1 Crítico', 'P2 Alta', 'P3 Média'],
    datasets: [{ data: [SEC.priorityTotals.p1, SEC.priorityTotals.p2, SEC.priorityTotals.p3], backgroundColor: ['#ef4444', '#f59e0b', '#eab308'], borderWidth: 0, spacing: 3, borderRadius: 4 }]
  },
  options: {
    responsive: true, cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = SEC.priorityTotals.p1 + SEC.priorityTotals.p2 + SEC.priorityTotals.p3;
            const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0;
            return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
          }
        }
      }
    }
  }
});

// 4c: Top requesters bar
new Chart(document.getElementById('reqBarChart'), {
  type: 'bar',
  data: {
    labels: SEC.req.labels,
    datasets: [{ label: 'Demandas', data: SEC.req.values, backgroundColor: '#3b82f6', borderRadius: 6, borderSkipped: false }]
  },
  options: {
    responsive: true, indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, grid: { display: false } },
      y: { grid: { display: false } }
    }
  }
});

// ===== SECTION 5: Análise Geral =====
// 5a: Volume by month stacked by client
(function() {
  const datasets = SEC.clientMonth.clients.map((c, i) => ({
    label: c,
    data: SEC.clientMonth.series[i],
    backgroundColor: SEC.clientMonth.colors[i],
    borderRadius: 3,
    stack: 's8',
    maxBarThickness: 60,
    barPercentage: 0.8,
    categoryPercentage: 0.6,
  }));
  new Chart(document.getElementById('generalMonthClient'), {
    type: 'bar',
    data: { labels: SEC.clientMonth.labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } } } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, grid: { display: false } }
      }
    }
  });
})();

// 5b: P1/P2/P3 per client horizontal stacked
new Chart(document.getElementById('generalClientPrio'), {
  type: 'bar',
  data: {
    labels: SEC.clientPrio.labels,
    datasets: [
      { label: 'P1', data: SEC.clientPrio.p1, backgroundColor: '#ef4444', borderRadius: 4, stack: 's9' },
      { label: 'P2', data: SEC.clientPrio.p2, backgroundColor: '#f59e0b', borderRadius: 4, stack: 's9' },
      { label: 'P3', data: SEC.clientPrio.p3, backgroundColor: '#eab308', borderRadius: 4, stack: 's9' },
    ]
  },
  options: {
    responsive: true, indexAxis: 'y',
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { stacked: true, beginAtZero: true, grid: { display: false } },
      y: { stacked: true, grid: { display: false } }
    }
  }
});

// 5c: Problema/Bug vs Tarefa/Ajuda per client
new Chart(document.getElementById('generalClientType'), {
  type: 'bar',
  data: {
    labels: SEC.clientType.labels,
    datasets: [
      { label: 'Problema/Bug', data: SEC.clientType.bug, backgroundColor: '#1e3a5f', borderRadius: 4, stack: 's10' },
      { label: 'Tarefa/Ajuda', data: SEC.clientType.tarefa, backgroundColor: '#f97316', borderRadius: 4, stack: 's10' },
    ]
  },
  options: {
    responsive: true, indexAxis: 'y',
    plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } } },
    scales: {
      x: { stacked: true, beginAtZero: true, grid: { display: false } },
      y: { stacked: true, grid: { display: false } }
    }
  }
});

// 5d: Total per client bar (horizontal)
(function() {
  const totals = SEC.clientPrio.labels.map((_, i) => (SEC.clientPrio.p1[i] || 0) + (SEC.clientPrio.p2[i] || 0) + (SEC.clientPrio.p3[i] || 0));
  // Use all client data (not just p1/p2/p3 classified) from clientMonth
  const clientTotals = SEC.clientMonth.clients.map((c, i) => SEC.clientMonth.series[i].reduce((a, b) => a + b, 0));
  new Chart(document.getElementById('generalClientTotal'), {
    type: 'bar',
    data: {
      labels: SEC.clientMonth.clients,
      datasets: [{
        label: 'Total de Demandas',
        data: clientTotals,
        backgroundColor: SEC.clientMonth.colors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { display: false } },
        y: { grid: { display: false } }
      }
    }
  });
})();

// ===== SECTION 6: Média de Tempo por Prioridade =====
// 6a: Resolution time vs SLA grouped bar
new Chart(document.getElementById('prioAvgResChart'), {
  type: 'bar',
  data: {
    labels: PRIO_AVG.map(p => p.label),
    datasets: [
      {
        label: 'Tempo Médio Resolução',
        data: PRIO_AVG.map(p => p.avgRes),
        backgroundColor: PRIO_AVG.map(p => p.avgRes > p.slaRes ? '#ef4444' : '#22c55e'),
        borderRadius: 6, borderSkipped: false, maxBarThickness: 50, barPercentage: 0.8, categoryPercentage: 0.6,
      },
      {
        label: 'Limite SLA',
        data: PRIO_AVG.map(p => p.slaRes),
        backgroundColor: 'rgba(148,163,184,0.35)',
        borderRadius: 6, borderSkipped: false, maxBarThickness: 50, barPercentage: 0.8, categoryPercentage: 0.6,
      },
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
      tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + fmtH(ctx.parsed.y); } } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { display: false }, title: { display: true, text: 'Horas' } }
    }
  }
});

// 6b: First response time vs SLA grouped bar
new Chart(document.getElementById('prioAvgRespChart'), {
  type: 'bar',
  data: {
    labels: PRIO_AVG.map(p => p.label),
    datasets: [
      {
        label: 'Tempo Médio 1ª Resposta',
        data: PRIO_AVG.map(p => p.avgResp),
        backgroundColor: PRIO_AVG.map(p => p.avgResp > p.slaResp ? '#ef4444' : '#22c55e'),
        borderRadius: 6, borderSkipped: false, maxBarThickness: 50, barPercentage: 0.8, categoryPercentage: 0.6,
      },
      {
        label: 'Limite SLA',
        data: PRIO_AVG.map(p => p.slaResp),
        backgroundColor: 'rgba(148,163,184,0.35)',
        borderRadius: 6, borderSkipped: false, maxBarThickness: 50, barPercentage: 0.8, categoryPercentage: 0.6,
      },
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true } },
      tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + fmtH(ctx.parsed.y); } } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { display: false }, title: { display: true, text: 'Horas' } }
    }
  }
});

// 6c: Stat cards per priority
(function() {
  const container = document.getElementById('prioAvgCards');
  const BADGE_COLORS = { 'P1 - Crítico': '#ef4444', 'P2 - Alta': '#f59e0b', 'P3 - Média': '#3b82f6' };
  PRIO_AVG.forEach(p => {
    const resOk = p.avgRes <= p.slaRes;
    const respOk = p.avgResp <= p.slaResp;
    const avgRespMins = Math.round(p.avgResp * 60);
    const badgeColor = BADGE_COLORS[p.label] || '#64748b';
    const card = document.createElement('div');
    card.style.cssText = 'flex:1;min-width:200px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;';
    card.innerHTML = \`
      <div style="display:inline-block;background:\${badgeColor}22;color:\${badgeColor};padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:14px;">\${p.label}</div>
      <div style="font-size:13px;margin-bottom:8px;">
        <span style="color:var(--text-muted);">Resolução:</span>
        <strong style="color:\${resOk ? '#22c55e' : '#ef4444'};margin-left:6px;">\${fmtH(p.avgRes)}</strong>
        <span style="color:var(--text-dim);font-size:11px;margin-left:4px;">(SLA: \${fmtH(p.slaRes)})</span>
      </div>
      <div style="font-size:13px;margin-bottom:8px;">
        <span style="color:var(--text-muted);">1ª Resposta:</span>
        <strong style="color:\${respOk ? '#22c55e' : '#ef4444'};margin-left:6px;">\${fmtMins(avgRespMins)}</strong>
        <span style="color:var(--text-dim);font-size:11px;margin-left:4px;">(SLA: \${fmtMins(Math.round(p.slaResp * 60))})</span>
      </div>
      <div style="font-size:12px;color:var(--text-dim);">Demandas: <strong style="color:var(--text);">\${p.count}</strong></div>
    \`;
    container.appendChild(card);
  });
})();

// Table interaction
const PAGE_SIZE = 25;
let currentPage = 0;
let currentFilter = 'all';
let currentSearch = '';

function getVisibleRows() {
  const rows = Array.from(document.querySelectorAll('#tableBody .table-row'));
  return rows.filter(r => {
    const matchFilter = currentFilter === 'all'
      || (currentFilter === 'aberta' && (r.dataset.status === 'aberta' || r.dataset.status === 'em_andamento'))
      || (currentFilter === 'concluida' && r.dataset.status === 'concluida')
      || (currentFilter === 'sla_breach' && r.dataset.sla === 'breach');
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
