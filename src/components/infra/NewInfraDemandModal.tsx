/**
 * Modal pra abrir uma nova demanda interna (Infra).
 *
 * Tabs SQL | Deploy. Cada uma tem o mesmo formulario, so muda o infraKind
 * que vai ser enviado pro backend. Responsavel default = Tiago Silva.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Database, Rocket, Loader2, Copy, Plus, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { loadInfraDatabases, addInfraDatabase } from "@/lib/infraDatabases";

interface NewInfraDemandModalProps {
  open: boolean;
  defaultKind: "sql" | "deploy";
  onClose: () => void;
  onCreated: () => void;
}

const NewInfraDemandModal = ({ open, defaultKind, onClose, onCreated }: NewInfraDemandModalProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [kind, setKind] = useState<"sql" | "deploy">(defaultKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"p1" | "p2" | "p3">("p3");
  const [client, setClient] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Campos SQL-specific
  const [query, setQuery] = useState("");
  const [database, setDatabase] = useState<string>("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState("");
  const [showAddDbInput, setShowAddDbInput] = useState(false);
  const [newDbName, setNewDbName] = useState("");

  // Carrega lista de bancos quando modal abre
  const refreshDatabases = useCallback(() => {
    setDatabases(loadInfraDatabases());
  }, []);

  // Sincroniza tab default quando modal abre
  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setTitle("");
      setDescription("");
      setPriority("p3");
      setClient("");
      setDueDate("");
      setQuery("");
      setDatabase("");
      setExternalLink("");
      setShowAddDbInput(false);
      setNewDbName("");
      refreshDatabases();
    }
  }, [open, defaultKind, refreshDatabases]);

  const handleCopyQuery = async () => {
    if (!query.trim()) {
      toast({ title: "Query vazia", description: "Nada pra copiar", variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(query);
      toast({ title: "Query copiada", description: `${query.length} caracteres` });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleAddDatabase = () => {
    const name = newDbName.trim();
    if (!name) {
      setShowAddDbInput(false);
      return;
    }
    const updated = addInfraDatabase(name);
    setDatabases(updated);
    setDatabase(name); // seleciona o recem-adicionado
    setNewDbName("");
    setShowAddDbInput(false);
    toast({ title: "Banco adicionado", description: name });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiClient.infra.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        infraKind: kind,
        requester: {
          name: currentUser?.name || currentUser?.login || "Anônimo",
          avatar: "",
        },
        // assignee fixo: Tiago Silva (regra de negocio)
        assignee: { name: "Tiago Silva", avatar: "" },
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        client: client.trim() || undefined,
        // SQL-specific (vai vazio em deploy)
        infraQuery: kind === "sql" && query.trim() ? query.trim() : undefined,
        infraDatabase: kind === "sql" && database ? database : undefined,
        infraExternalLink: externalLink.trim() || undefined,
      });
      toast({
        title: `Demanda de ${kind === "sql" ? "Operações SQL" : "Deploy"} criada`,
        description: "Atribuída a Tiago Silva.",
      });
      onCreated();
    } catch (e) {
      toast({
        title: "Erro ao criar demanda",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova demanda Infra</DialogTitle>
          <DialogDescription>
            Demandas internas atendidas pelo time de Infra. Responsável padrão: <strong>Tiago Silva</strong>.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(v) => setKind(v as "sql" | "deploy")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="sql" className="gap-2">
              <Database size={14} /> Operações SQL
            </TabsTrigger>
            <TabsTrigger value="deploy" className="gap-2">
              <Rocket size={14} /> Deploy
            </TabsTrigger>
          </TabsList>

          {/* Form igual pra ambas tabs — o kind so muda no payload */}
          <TabsContent value={kind} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "sql" ? "Ex: Update na tabela X" : "Ex: Deploy v2.4.1 — release patch"}
                maxLength={150}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da demanda, contexto, scripts, ambiente, etc."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as "p1" | "p2" | "p3")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p1">P1 — Crítico</SelectItem>
                    <SelectItem value="p2">P2 — Alta</SelectItem>
                    <SelectItem value="p3">P3 — Média (padrão)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data limite (opcional)</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cliente afetado (opcional)</label>
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Ex: VSPay, eFleet, SmartVale"
                maxLength={80}
              />
            </div>

            {/* ===== Campos SQL-specific ===== */}
            {kind === "sql" && (
              <>
                {/* Banco de dados */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Banco de Dados</label>
                  {showAddDbInput ? (
                    <div className="flex gap-2">
                      <Input
                        value={newDbName}
                        onChange={(e) => setNewDbName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); handleAddDatabase(); }
                          if (e.key === "Escape") { setShowAddDbInput(false); setNewDbName(""); }
                        }}
                        placeholder="Nome do novo banco"
                        autoFocus
                      />
                      <Button type="button" onClick={handleAddDatabase} size="sm">
                        Adicionar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowAddDbInput(false); setNewDbName(""); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select value={database} onValueChange={setDatabase}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um banco..." />
                        </SelectTrigger>
                        <SelectContent>
                          {databases.length === 0 ? (
                            <div className="py-2 px-3 text-xs text-muted-foreground">
                              Nenhum banco cadastrado
                            </div>
                          ) : (
                            databases.map((db) => (
                              <SelectItem key={db} value={db}>{db}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddDbInput(true)}
                        title="Adicionar novo banco à lista"
                        className="gap-1.5"
                      >
                        <Plus size={14} /> Novo
                      </Button>
                    </div>
                  )}
                </div>

                {/* Query */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Query SQL</label>
                    {query.trim() && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyQuery}
                        className="h-7 gap-1.5 text-xs"
                      >
                        <Copy size={12} /> Copiar query
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SELECT * FROM ..."
                    rows={6}
                    className="font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
              </>
            )}

            {/* Link da demanda (ambos os tipos) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <ExternalLink size={12} /> Link da demanda (opcional)
              </label>
              <Input
                type="url"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="https://app.clickup.com/t/... ou outro link de referência"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()} className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Abrir demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewInfraDemandModal;
