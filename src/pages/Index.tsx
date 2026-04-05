import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, CheckSquare, Users, TrendingUp } from "lucide-react";

const stats = [
  { title: "Tarefas Abertas", value: "24", icon: CheckSquare, change: "+3 hoje", color: "text-primary" },
  { title: "Cadastros Ativos", value: "1.248", icon: Users, change: "+12 esta semana", color: "text-success" },
  { title: "Relatórios Gerados", value: "86", icon: BarChart3, change: "+5 este mês", color: "text-info" },
  { title: "Taxa de Conclusão", value: "94%", icon: TrendingUp, change: "+2.4%", color: "text-warning" },
];

const recentTasks = [
  { name: "Atualizar cadastro de fornecedores", status: "Em andamento", priority: "Alta" },
  { name: "Revisar relatório mensal", status: "Pendente", priority: "Média" },
  { name: "Cadastrar novos produtos", status: "Concluída", priority: "Baixa" },
  { name: "Verificar estoque mínimo", status: "Em andamento", priority: "Alta" },
  { name: "Atualizar tabela de preços", status: "Pendente", priority: "Média" },
];

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema de operações</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <Card key={stat.title} className="border border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-semibold mt-1 text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Tasks */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Tarefas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTasks.map((task, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm text-foreground">{task.name}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        task.status === "Concluída"
                          ? "bg-success/10 text-success"
                          : task.status === "Em andamento"
                          ? "bg-info/10 text-info"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {task.status}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        task.priority === "Alta"
                          ? "text-destructive"
                          : task.priority === "Média"
                          ? "text-warning"
                          : "text-muted-foreground"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
