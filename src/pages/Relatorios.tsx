import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const monthlyData = [
  { month: "Jan", tarefas: 45, concluidas: 38 },
  { month: "Fev", tarefas: 52, concluidas: 47 },
  { month: "Mar", tarefas: 61, concluidas: 55 },
  { month: "Abr", tarefas: 48, concluidas: 44 },
  { month: "Mai", tarefas: 55, concluidas: 50 },
  { month: "Jun", tarefas: 67, concluidas: 62 },
];

const cadastrosData = [
  { month: "Jan", novos: 15 },
  { month: "Fev", novos: 22 },
  { month: "Mar", novos: 18 },
  { month: "Abr", novos: 30 },
  { month: "Mai", novos: 25 },
  { month: "Jun", novos: 35 },
];

const Relatorios = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground text-sm mt-1">Análise e métricas do sistema</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Calendar size={16} className="mr-2" /> Período
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-2" /> Exportar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tarefas por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215, 14%, 50%)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(215, 14%, 50%)" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 20%, 90%)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="tarefas" fill="hsl(215, 60%, 42%)" radius={[4, 4, 0, 0]} name="Total" />
                  <Bar dataKey="concluidas" fill="hsl(152, 55%, 42%)" radius={[4, 4, 0, 0]} name="Concluídas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line Chart */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Novos Cadastros</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cadastrosData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215, 14%, 50%)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(215, 14%, 50%)" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 20%, 90%)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="novos"
                    stroke="hsl(200, 80%, 50%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(200, 80%, 50%)", r: 4 }}
                    name="Novos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Relatorios;
