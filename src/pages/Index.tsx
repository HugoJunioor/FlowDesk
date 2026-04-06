import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckSquare, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const stats = [
  { title: "Tarefas Abertas", value: "24", icon: CheckSquare, change: "+3 hoje", trend: "up", color: "text-primary", bg: "bg-primary/10" },
  { title: "Cadastros Ativos", value: "1.248", icon: Users, change: "+12 esta semana", trend: "up", color: "text-success", bg: "bg-success/10" },
  { title: "Relatorios Gerados", value: "86", icon: BarChart3, change: "+5 este mes", trend: "up", color: "text-info", bg: "bg-info/10" },
  { title: "Taxa de Conclusao", value: "94%", icon: TrendingUp, change: "-1.2%", trend: "down", color: "text-warning", bg: "bg-warning/10" },
];

const recentTasks = [
  { name: "Atualizar cadastro de fornecedores", status: "Em andamento", priority: "Alta" },
  { name: "Revisar relatorio mensal", status: "Pendente", priority: "Media" },
  { name: "Cadastrar novos produtos", status: "Concluida", priority: "Baixa" },
  { name: "Verificar estoque minimo", status: "Em andamento", priority: "Alta" },
  { name: "Atualizar tabela de precos", status: "Pendente", priority: "Media" },
];

const weeklyData = [
  { day: "Seg", concluidas: 8, novas: 5 },
  { day: "Ter", concluidas: 12, novas: 9 },
  { day: "Qua", concluidas: 6, novas: 11 },
  { day: "Qui", concluidas: 15, novas: 7 },
  { day: "Sex", concluidas: 10, novas: 4 },
  { day: "Sab", concluidas: 3, novas: 1 },
  { day: "Dom", concluidas: 1, novas: 0 },
];

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visao geral do sistema de operacoes</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <Card key={stat.title} className="border border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  {stat.trend === "up" ? (
                    <ArrowUpRight size={14} className="text-success" />
                  ) : (
                    <ArrowDownRight size={14} className="text-destructive" />
                  )}
                  <span className={`text-xs font-medium ${stat.trend === "up" ? "text-success" : "text-destructive"}`}>
                    {stat.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Chart */}
          <Card className="border border-border shadow-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tarefas da Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weeklyData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="concluidas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Concluidas" />
                  <Bar dataKey="novas" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} name="Novas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card className="border border-border shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Tarefas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentTasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground truncate mr-3">{task.name}</span>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 text-[11px] ${
                        task.status === "Concluida"
                          ? "bg-success/10 text-success hover:bg-success/15"
                          : task.status === "Em andamento"
                          ? "bg-info/10 text-info hover:bg-info/15"
                          : "bg-warning/10 text-warning hover:bg-warning/15"
                      }`}
                    >
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
