import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter } from "lucide-react";

const tasks = [
  { id: 1, title: "Atualizar cadastro de fornecedores", assignee: "Maria S.", status: "Em andamento", priority: "Alta", date: "05/04/2026" },
  { id: 2, title: "Revisar relatório mensal de vendas", assignee: "João P.", status: "Pendente", priority: "Média", date: "04/04/2026" },
  { id: 3, title: "Cadastrar novos produtos do catálogo", assignee: "Ana L.", status: "Concluída", priority: "Baixa", date: "03/04/2026" },
  { id: 4, title: "Verificar estoque mínimo dos itens", assignee: "Carlos R.", status: "Em andamento", priority: "Alta", date: "05/04/2026" },
  { id: 5, title: "Atualizar tabela de preços Q2", assignee: "Maria S.", status: "Pendente", priority: "Média", date: "06/04/2026" },
  { id: 6, title: "Conferir notas fiscais do mês", assignee: "João P.", status: "Pendente", priority: "Alta", date: "07/04/2026" },
  { id: 7, title: "Organizar documentação de processos", assignee: "Ana L.", status: "Em andamento", priority: "Baixa", date: "02/04/2026" },
];

const statusColor = (status: string) => {
  switch (status) {
    case "Concluída": return "bg-success/10 text-success border-success/20";
    case "Em andamento": return "bg-info/10 text-info border-info/20";
    default: return "bg-warning/10 text-warning border-warning/20";
  }
};

const Tarefas = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tarefas</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie as tarefas da equipe</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter size={16} className="mr-2" /> Filtrar
            </Button>
            <Button size="sm">
              <Plus size={16} className="mr-2" /> Nova Tarefa
            </Button>
          </div>
        </div>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Tarefa</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Responsável</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Prioridade</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-foreground">{task.title}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{task.assignee}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium ${
                        task.priority === "Alta" ? "text-destructive" : task.priority === "Média" ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{task.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Tarefas;
