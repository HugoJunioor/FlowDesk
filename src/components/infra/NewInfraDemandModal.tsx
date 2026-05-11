/**
 * Modal pra abrir uma nova demanda interna (Infra).
 *
 * Tabs SQL | Deploy. Cada uma tem o mesmo formulario, so muda o infraKind
 * que vai ser enviado pro backend. Responsavel default = Tiago Silva.
 */
import { useState, useEffect } from "react";
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
import { Database, Rocket, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";

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

  // Sincroniza tab default quando modal abre
  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setTitle("");
      setDescription("");
      setPriority("p3");
      setClient("");
      setDueDate("");
    }
  }, [open, defaultKind]);

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
      <DialogContent className="max-w-lg">
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
