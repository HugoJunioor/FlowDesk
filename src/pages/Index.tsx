import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, CheckCircle2, Clock, Inbox, Building2,
  Users, BarChart3, CalendarDays, TrendingUp, Timer, MessageCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { mockDemands, extractClientName } from "@/data/mockDemands";
import { PRIORITY_CONFIG, SlackDemand } from "@/types/demand";
import { addBusinessHours, getBusinessMinutesBetween } from "@/lib/businessHours";

type Period = "hoje" | "semanal" | "mensal" | "personalizado";

const COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--muted-foreground))"];

const Dashboard = () => {
  const [period, setPeriod] = useState<Period>("mensal");
  const [client, setClient] = useState("");
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const clients = useMemo(() => {
    const set = new Set<string>();
    mockDemands.forEach((d) => {
      const c = extractClientName(d.slackChannel);
      if (c !== d.slackChannel) set.add(c);
    });
    return Array.from(set).sort();
  }, []);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "hoje": return { from: startOfDay(now), to: endOfDay(now) };
      case "semanal": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case "mensal": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "personalizado": return {
        from: customFrom || startOfMonth(now),
        to: customTo || endOfMonth(now),
      };
    }
  };

  const filtered = useMemo(() => {
    const range = getDateRange();
    return mockDemands.filter((d) => {
      const created = new Date(d.createdAt);
      if (created < range.from || created > range.to) return false;
      if (client && extractClientName(d.slackChannel) !== client) return false;
      return true;
    });
  }, [period, client, customFrom, customTo]);

  // === METRICS ===
  const total = filtered.length;
  const abertas = filtered.filter((d) => d.status === "aberta" || d.status === "em_andamento").length;
  const concluidas = filtered.filter((d) => d.status === "concluida").length;
  const expiradas = filtered.filter((d) => d.status === "expirada").length;
  const p1Count = filtered.filter((d) => d.priority === "p1").length;

  // SLA compliance
  const withSla = filtered.filter((d) => d.priority !== "sem_classificacao");
  const slaCompliant = withSla.filter((d) => {
    if (d.status === "concluida" && d.completedAt) {
      const config = PRIORITY_CONFIG[d.priority];
      if (!config.sla) return true;
      const due = addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours);
      return new Date(d.completedAt) <= due;
    }
    if (d.status === "expirada") return false;
    if (d.status === "aberta" || d.status === "em_andamento") {
      const config = PRIORITY_CONFIG[d.priority];
      if (!config.sla) return true;
      const due = addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours);
      return new Date() <= due;
    }
    return true;
  });
  const slaRate = withSla.length > 0 ? Math.round((slaCompliant.length / withSla.length) * 100) : 100;

  // Avg first response (mock: using replies > 0 as proxy)
  const withReplies = filtered.filter((d) => d.replies > 0);
  const avgFirstResponse = withReplies.length > 0
    ? Math.round(withReplies.reduce((sum, d) => {
        const config = PRIORITY_CONFIG[d.priority];
        if (d.priority === "sem_classificacao" || !config.sla) return sum + 30;
        // Simulated: response time proportional to SLA
        return sum + Math.min(config.sla.resolutionHours * 60 * 0.1, 60);
      }, 0) / withReplies.length)
    : 0;

  // === CHART DATA ===
  const priorityData = [
    { name: "P1", value: filtered.filter((d) => d.priority === "p1").length },
    { name: "P2", value: filtered.filter((d) => d.priority === "p2").length },
    { name: "P3", value: filtered.filter((d) => d.priority === "p3").length },
    { name: "N/C", value: filtered.filter((d) => d.priority === "sem_classificacao").length },
  ].filter((d) => d.value > 0);

  const clientData = clients.map((c) => ({
    name: c,
    abertas: filtered.filter((d) => extractClientName(d.slackChannel) === c && (d.status === "aberta" || d.status === "em_andamento")).length,
    concluidas: filtered.filter((d) => extractClientName(d.slackChannel) === c && d.status === "concluida").length,
    expiradas: filtered.filter((d) => extractClientName(d.slackChannel) === c && d.status === "expirada").length,
  })).filter((c) => c.abertas + c.concluidas + c.expiradas > 0);

  // SLA per client
  const clientSlaData = clients.map((c) => {
    const clientDemands = filtered.filter((d) => extractClientName(d.slackChannel) === c && d.priority !== "sem_classificacao");
    const compliant = clientDemands.filter((d) => {
      const config = PRIORITY_CONFIG[d.priority];
      if (!config.sla) return true;
      if (d.status === "concluida" && d.completedAt) {
        const due = addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours);
        return new Date(d.completedAt) <= due;
      }
      if (d.status === "expirada") return false;
      const due = addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours);
      return new Date() <= due;
    });
    const rate = clientDemands.length > 0 ? Math.round((compliant.length / clientDemands.length) * 100) : 100;
    return { name: c, rate, total: clientDemands.length };
  }).filter((c) => c.total > 0);

  // Critical demands needing attention
  const criticalDemands = filtered.filter((d) => {
    if (d.status === "concluida") return false;
    if (d.status === "expirada") return true;
    if (d.priority === "p1" && (d.status === "aberta" || d.status === "em_andamento")) return true;
    if (d.priority !== "sem_classificacao") {
      const config = PRIORITY_CONFIG[d.priority];
      if (config.sla) {
        const due = addBusinessHours(new Date(d.createdAt), config.sla.resolutionHours);
        const remaining = getBusinessMinutesBetween(new Date(), due);
        return remaining < 120; // menos de 2h uteis
      }
    }
    return false;
  }).slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header + filters */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Visao analitica das demandas Slack</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["hoje", "semanal", "mensal", "personalizado"] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs capitalize"
                onClick={() => setPeriod(p)}
              >
                {p === "personalizado" && <CalendarDays size={13} className="mr-1" />}
                {p}
              </Button>
            ))}

            {period === "personalizado" && (
              <div className="flex items-center gap-2">
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <CalendarDays size={13} className="mr-1" />
                      {customFrom ? format(customFrom, "dd/MM", { locale: ptBR }) : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d || undefined); setFromOpen(false); }} locale={ptBR} initialFocus />
                  </PopoverContent>
                </Popover>
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <CalendarDays size={13} className="mr-1" />
                      {customTo ? format(customTo, "dd/MM", { locale: ptBR }) : "Ate"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d || undefined); setToOpen(false); }} locale={ptBR} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <select
              className="h-8 rounded-md border border-input bg-background px-3 text-xs text-foreground"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: "Total", value: total, icon: BarChart3, color: "text-foreground", bg: "bg-muted" },
            { title: "Abertas", value: abertas, icon: Inbox, color: "text-primary", bg: "bg-primary/10" },
            { title: "P1 Criticos", value: p1Count, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
            { title: "Concluidas", value: concluidas, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
            { title: "Expiradas", value: expiradas, icon: Clock, color: "text-destructive", bg: "bg-destructive/10" },
            { title: "SLA %", value: `${slaRate}%`, icon: TrendingUp, color: slaRate >= 80 ? "text-success" : slaRate >= 50 ? "text-warning" : "text-destructive", bg: slaRate >= 80 ? "bg-success/10" : slaRate >= 50 ? "bg-warning/10" : "bg-destructive/10" },
          ].map((kpi) => (
            <Card key={kpi.title} className="border border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
                    <kpi.icon size={14} className={kpi.color} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{kpi.title}</span>
                </div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Demandas por cliente */}
          <Card className="border border-border shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 size={16} className="text-primary" />
                Demandas por Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={clientData} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="abertas" fill="hsl(var(--info))" radius={[3, 3, 0, 0]} name="Abertas" stackId="a" />
                  <Bar dataKey="concluidas" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} name="Concluidas" stackId="a" />
                  <Bar dataKey="expiradas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} name="Expiradas" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuicao por prioridade */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning" />
                Por Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {priorityData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {priorityData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-[11px] text-muted-foreground">{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SLA por cliente */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Timer size={16} className="text-info" />
                SLA por Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {clientSlaData.map((c) => (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                    </div>
                    <span className={`text-xs font-bold ${c.rate >= 80 ? "text-success" : c.rate >= 50 ? "text-warning" : "text-destructive"}`}>
                      {c.rate}%
                    </span>
                  </div>
                  <Progress value={c.rate} className="h-2" />
                </div>
              ))}
              {clientSlaData.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sem dados no periodo</p>
              )}
            </CardContent>
          </Card>

          {/* Demandas criticas */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle size={16} className="text-destructive" />
                Atencao Imediata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {criticalDemands.map((d) => {
                const pConfig = PRIORITY_CONFIG[d.priority];
                const clientName = extractClientName(d.slackChannel);
                return (
                  <div key={d.id} className={`p-3 rounded-lg border-l-[3px] ${pConfig.border} bg-muted/30`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={`text-[10px] ${pConfig.bg} ${pConfig.color}`}>
                            {pConfig.shortLabel}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Building2 size={10} /> {clientName}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {d.assignee?.name || "Sem resp."}
                          </span>
                        </div>
                      </div>
                      {d.status === "expirada" ? (
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px] shrink-0 animate-pulse">
                          Expirado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-warning/10 text-warning text-[10px] shrink-0">
                          Critico
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {criticalDemands.length === 0 && (
                <div className="flex flex-col items-center py-6 text-muted-foreground">
                  <CheckCircle2 size={24} className="text-success mb-2" />
                  <p className="text-xs">Nenhuma demanda critica no momento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* First response + summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <MessageCircle size={20} className="text-info mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{avgFirstResponse}m</p>
              <p className="text-[11px] text-muted-foreground mt-1">Tempo medio 1a resposta</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <Users size={20} className="text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{new Set(filtered.map((d) => d.assignee?.name).filter(Boolean)).size}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Responsaveis ativos</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <Building2 size={20} className="text-warning mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{new Set(filtered.map((d) => extractClientName(d.slackChannel))).size}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Clientes atendidos</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <TrendingUp size={20} className={`mx-auto mb-2 ${concluidas > expiradas ? "text-success" : "text-destructive"}`} />
              <p className="text-2xl font-bold text-foreground">{total > 0 ? Math.round((concluidas / total) * 100) : 0}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">Taxa de conclusao</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
