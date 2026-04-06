import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Mail, Phone } from "lucide-react";

const records = [
  { id: 1, name: "Distribuidora ABC", type: "Fornecedor", email: "contato@abc.com", phone: "(11) 9999-1234", status: "Ativo" },
  { id: 2, name: "Tech Solutions Ltda", type: "Cliente", email: "info@techsol.com", phone: "(21) 8888-5678", status: "Ativo" },
  { id: 3, name: "Logistica Express", type: "Fornecedor", email: "ops@logexp.com", phone: "(31) 7777-9012", status: "Inativo" },
  { id: 4, name: "Comercio Digital SA", type: "Cliente", email: "vendas@comdig.com", phone: "(41) 6666-3456", status: "Ativo" },
  { id: 5, name: "Industria Nacional", type: "Fornecedor", email: "suporte@indnat.com", phone: "(51) 5555-7890", status: "Ativo" },
  { id: 6, name: "StartUp Inovacao", type: "Cliente", email: "hello@startup.io", phone: "(61) 4444-2345", status: "Ativo" },
];

const Cadastros = () => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.email.toLowerCase().includes(search.toLowerCase()) ||
          r.type.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <Input
            placeholder="Buscar cadastros..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((record) => (
            <Card key={record.id} className="border border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {record.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{record.name}</h3>
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {record.type}
                      </Badge>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${
                      record.status === "Ativo" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {record.status}
                  </Badge>
                </div>

                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate">{record.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="shrink-0" />
                    <span>{record.phone}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-muted-foreground text-xs">
                    <Pencil size={14} className="mr-1.5" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-destructive text-xs">
                    <Trash2 size={14} className="mr-1.5" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
              Nenhum cadastro encontrado.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Cadastros;
