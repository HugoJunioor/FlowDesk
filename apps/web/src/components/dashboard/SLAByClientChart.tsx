import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "lucide-react";
import { getProcessedDemands, extractClientName, subscribeToSync } from "@/data/demandsLoader";
import { isSlaCompliant } from "@/lib/slaCalculator";
import { SLA_TARGET_PERCENT } from "@/lib/slaCalculator";

const tooltipStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  padding: "8px 12px",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const rate: number = d?.rate ?? 0;
  const total: number = d?.total ?? 0;
  const dentro: number = d?.dentro ?? 0;
  const fora: number = total - dentro;
  const color = rate >= SLA_TARGET_PERCENT ? "#22c55e" : rate >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={tooltipStyle}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: "hsl(var(--foreground))" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, display: "inline-block" }} />
        <span style={{ fontWeight: 700 }}>{rate}%</span>
        <span style={{ color: "hsl(var(--muted-foreground))" }}>dentro do SLA</span>
      </div>
      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}>
        <span>{total} {total === 1 ? "demanda" : "demandas"} no total</span>
        <span style={{ margin: "0 6px" }}>·</span>
        <span style={{ color: "#22c55e" }}>{dentro} ok</span>
        <span style={{ margin: "0 6px" }}>·</span>
        <span style={{ color: "#ef4444" }}>{fora} fora</span>
      </div>
    </div>
  );
};

/** Tick customizado para truncar nomes longos no eixo Y */
const CustomYAxisTick = ({ x, y, payload }: any) => {
  const name: string = payload?.value ?? "";
  const max = 18;
  const display = name.length > max ? name.slice(0, max) + "…" : name;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="hsl(var(--muted-foreground))"
      fontSize={11}
    >
      {display}
    </text>
  );
};

export interface SLAByClientChartProps {
  /** Demandas pre-filtradas (se undefined, carrega todos os ultimos 30 dias). */
  demands?: ReturnType<typeof getProcessedDemands>;
}

const SLAByClientChart = ({ demands }: SLAByClientChartProps) => {
  // Re-render quando sync polling detectar novo realDemands.ts
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => subscribeToSync(() => setSyncTick((t) => t + 1)), []);

  const chartData = useMemo(() => {
    const source = demands ?? (() => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return getProcessedDemands().filter((d) => new Date(d.createdAt) >= cutoff);
    })();
    void syncTick; // dependency pra useMemo re-executar

    // Agrupa por cliente
    const byClient: Record<string, { total: number; dentro: number }> = {};
    for (const d of source) {
      if (d.priority === "sem_classificacao") continue;
      const clientName = extractClientName(d.slackChannel);
      if (clientName === d.slackChannel) continue; // canal sem nome de cliente
      if (!byClient[clientName]) byClient[clientName] = { total: 0, dentro: 0 };
      byClient[clientName].total += 1;
      if (isSlaCompliant(d)) byClient[clientName].dentro += 1;
    }

    // Top 10 por volume, ordem crescente para barras horizontais (ultimo = topo)
    return Object.entries(byClient)
      .filter(([, v]) => v.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, v]) => ({
        name,
        rate: Math.round((v.dentro / v.total) * 100),
        total: v.total,
        dentro: v.dentro,
      }))
      .reverse(); // recharts horizontal: primeiro entry = barra de baixo
  }, [demands, syncTick]);

  // Altura dinamica: 48px por barra + cabecalho
  const chartHeight = Math.max(160, chartData.length * 48);

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Timer size={16} className="text-info" />
          SLA por Cliente — Ultimos 30 dias
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          % de demandas dentro do SLA por cliente (top 10 por volume). Meta: {SLA_TARGET_PERCENT}%.
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-10">
            Sem dados nos ultimos 30 dias
          </p>
        ) : (
          /* Scroll horizontal em mobile */
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 4, left: 120 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={115}
                    tick={<CustomYAxisTick />}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                  <ReferenceLine
                    x={SLA_TARGET_PERCENT}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    ifOverflow="extendDomain"
                  />
                  <Bar dataKey="rate" name="SLA (%)" radius={[0, 3, 3, 0]} maxBarSize={28}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          entry.rate >= SLA_TARGET_PERCENT
                            ? "#22c55e"
                            : entry.rate >= 50
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SLAByClientChart;
