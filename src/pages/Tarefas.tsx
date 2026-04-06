import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronLeft, ChevronRight, MoreHorizontal, ArrowUpDown } from "lucide-react";

const allTasks = [
  { id: 1, title: "Atualizar cadastro de fornecedores", assignee: "Maria S.", status: "Em andamento", priority: "Alta", date: "05/04/2026" },
  { id: 2, title: "Revisar relatorio mensal de vendas", assignee: "Joao P.", status: "Pendente", priority: "Media", date: "04/04/2026" },
  { id: 3, title: "Cadastrar novos produtos do catalogo", assignee: "Ana L.", status: "Concluida", priority: "Baixa", date: "03/04/2026" },
  { id: 4, title: "Verificar estoque minimo dos itens", assignee: "Carlos R.", status: "Em andamento", priority: "Alta", date: "05/04/2026" },
  { id: 5, title: "Atualizar tabela de precos Q2", assignee: "Maria S.", status: "Pendente", priority: "Media", date: "06/04/2026" },
  { id: 6, title: "Conferir notas fiscais do mes", assignee: "Joao P.", status: "Pendente", priority: "Alta", date: "07/04/2026" },
  { id: 7, title: "Organizar documentacao de processos", assignee: "Ana L.", status: "Em andamento", priority: "Baixa", date: "02/04/2026" },
  { id: 8, title: "Revisar contratos de fornecimento", assignee: "Carlos R.", status: "Pendente", priority: "Alta", date: "08/04/2026" },
  { id: 9, title: "Preparar apresentacao trimestral", assignee: "Maria S.", status: "Pendente", priority: "Media", date: "09/04/2026" },
  { id: 10, title: "Auditoria de inventario geral", assignee: "Joao P.", status: "Em andamento", priority: "Alta", date: "10/04/2026" },
];

const ITEMS_PER_PAGE = 5;

const statusColor = (status: string) => {
  switch (status) {
    case "Concluida": return "bg-success/10 text-success hover:bg-success/15";
    case "Em andamento": return "bg-info/10 text-info hover:bg-info/15";
    default: return "bg-warning/10 text-warning hover:bg-warning/15";
  }
};

const priorityColor = (priority: string) => {
  switch (priority) {
    case "Alta": return "text-destructive";
    case "Media": return "text-warning";
    default: return "text-muted-foreground";
  }
};

const Tarefas = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<"title" | "date" | "priority">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = allTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.assignee.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "date") cmp = a.date.localeCompare(b.date);
      else {
        const order = { Alta: 3, Media: 2, Baixa: 1 };
        cmp = (order[a.priority as keyof typeof order] || 0) - (order[b.priority as keyof typeof order] || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [search, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tarefas</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie as tarefas da equipe</p>
          </div>
          <Button size="sm">
            <Plus size={16} className="mr-2" /> Nova Tarefa
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas ou responsavel..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>

        <Card className="border border-border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th
                      className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort("title")}
                    >
                      <span className="flex items-center gap-1">Tarefa <ArrowUpDown size={12} /></span>
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Responsavel</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                    <th
                      className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort("priority")}
                    >
                      <span className="flex items-center gap-1">Prioridade <ArrowUpDown size={12} /></span>
                    </th>
                    <th
                      className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort("date")}
                    >
                      <span className="flex items-center gap-1">Data <ArrowUpDown size={12} /></span>
                    </th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((task) => (
                    <tr key={task.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-foreground font-medium">{task.title}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{task.assignee}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant="secondary" className={`text-[11px] ${statusColor(task.status)}`}>
                          {task.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold ${priorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{task.date}</td>
                      <td className="px-3 py-3.5">
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        Nenhuma tarefa encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {filtered.length} tarefa{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button
                      key={i}
                      variant={page === i ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page === totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Tarefas;
