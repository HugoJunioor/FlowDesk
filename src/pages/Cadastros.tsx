import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const records = [
  { id: 1, name: "Distribuidora ABC", type: "Fornecedor", email: "contato@abc.com", phone: "(11) 9999-1234", status: "Ativo" },
  { id: 2, name: "Tech Solutions Ltda", type: "Cliente", email: "info@techsol.com", phone: "(21) 8888-5678", status: "Ativo" },
  { id: 3, name: "Logística Express", type: "Fornecedor", email: "ops@logexp.com", phone: "(31) 7777-9012", status: "Inativo" },
  { id: 4, name: "Comércio Digital SA", type: "Cliente", email: "vendas@comdig.com", phone: "(41) 6666-3456", status: "Ativo" },
  { id: 5, name: "Indústria Nacional", type: "Fornecedor", email: "suporte@indnat.com", phone: "(51) 5555-7890", status: "Ativo" },
  { id: 6, name: "StartUp Inovação", type: "Cliente", email: "hello@startup.io", phone: "(61) 4444-2345", status: "Ativo" },
];

const Cadastros = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cadastros</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie clientes, fornecedores e parceiros</p>
          </div>
          <Button size="sm">
            <Plus size={16} className="mr-2" /> Novo Cadastro
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cadastros..." className="pl-9" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((record) => (
            <Card key={record.id} className="border border-border shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{record.name}</h3>
                    <span className="text-xs text-muted-foreground">{record.type}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    record.status === "Ativo" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  }`}>
                    {record.status}
                  </span>
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <p>{record.email}</p>
                  <p>{record.phone}</p>
                </div>
                <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground">
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Cadastros;
