/**
 * Modal pra abrir uma nova demanda interna (Infra).
 *
 * Tabs SQL | Deploy. Cada uma tem o mesmo formulario, so muda o infraKind
 * que vai ser enviado pro backend. Responsavel default = Tiago Silva.
 */
import { useState, useEffect, useCallback, useRef } from "react";
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
import { Database, Rocket, Loader2, Copy, Plus, ExternalLink, Paperclip, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { loadInfraDatabases, addInfraDatabase } from "@/lib/infraDatabases";
import { addBusinessHours } from "@/lib/businessHours";
import { PRIORITY_CONFIG } from "@/types/demand";
import { notifyAssigned } from "@/lib/notificationEvents";

interface NewInfraDemandModalProps {
  open: boolean;
  defaultKind: "sql" | "deploy";
  onClose: () => void;
  onCreated: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;

/**
 * Tipos de execucao SQL pre-definidos. Substituem o titulo livre
 * em demandas SQL pra padronizar metricas e relatorios.
 *
 * Os 3 primeiros (UPDATE, INSERT, DELETE) sao os mais comuns —
 * ficam separados no topo do dropdown via grupo.
 */
const SQL_EXECUTION_TYPES_PRIMARY = ["UPDATE", "INSERT", "DELETE"] as const;

const SQL_EXECUTION_TYPES_OTHERS = [
  "SELECT",
  "Criação de tabela",
  "Criação de coluna",
  "Alteração de coluna",
  "Drop de tabela",
  "Drop de coluna",
  "Criar FUNCTION",
  "Alterar FUNCTION",
  "Criar TRIGGER",
  "Alterar TRIGGER",
  "Criar INDEX",
  "Backup / Restore",
  "Outro",
] as const;

interface InfraAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  addedAt: string;
}

/** Formata YYYY-MM-DDTHH:MM pra value de input type=datetime-local */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Formata Date pra exibicao no preview (ex: "13/05 14:30") */
function fmtPreview(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
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
  // Anexos
  const [attachments, setAttachments] = useState<InfraAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview da data limite calculada (auto via prioridade)
  const autoDueDate = (() => {
    const cfg = PRIORITY_CONFIG[priority];
    if (!cfg?.sla) return null;
    return addBusinessHours(new Date(), cfg.sla.resolutionHours);
  })();

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
      setAttachments([]);
      refreshDatabases();
    }
  }, [open, defaultKind, refreshDatabases]);

  // Quando troca de tab (SQL <-> Deploy), limpa o titulo pra evitar
  // que valor selecionado num tipo fique no outro (ex: "UPDATE" indo
  // pro Deploy onde ele e texto livre).
  useEffect(() => {
    setTitle("");
  }, [kind]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_FILES - attachments.length;
    if (remaining <= 0) {
      toast({ title: `Máximo ${MAX_FILES} anexos`, variant: "destructive" });
      return;
    }
    const accepted: InfraAttachment[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name}: ${formatBytes(file.size)} (máx 5MB)`,
          variant: "destructive",
        });
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        accepted.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          addedAt: new Date().toISOString(),
        });
      } catch (e) {
        toast({
          title: "Erro ao ler arquivo",
          description: file.name,
          variant: "destructive",
        });
      }
    }
    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

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
      // Data limite: se user nao preencheu, calcula auto baseado no SLA
      // da prioridade (P1=4h, P2=8h, P3=24h uteis).
      const finalDueDate = dueDate
        ? new Date(dueDate).toISOString()
        : autoDueDate
        ? autoDueDate.toISOString()
        : null;

      const created = await apiClient.infra.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        // SQL e Deploy requerem aprovação antes de serem executados
        status: (kind === "sql" || kind === "deploy") ? "aguardando_aprovacao" : "aberta",
        infraKind: kind,
        requester: {
          name: currentUser?.name || currentUser?.login || "Anônimo",
          avatar: "",
        },
        // assignee fixo: Tiago Silva (regra de negocio)
        assignee: { name: "Tiago Silva", avatar: "" },
        dueDate: finalDueDate,
        client: client.trim() || undefined,
        // Query so faz sentido em SQL (deploy nao tem). Banco fica em ambos.
        infraQuery: kind === "sql" && query.trim() ? query.trim() : undefined,
        infraDatabase: database || undefined,
        infraExternalLink: externalLink.trim() || undefined,
        // Anexos (so envia se houver — payload pode ficar grande, eh base64)
        ...(attachments.length > 0 ? { infraAttachments: attachments } : {}),
      });
      // Notifica o assignee (Tiago Silva) que tem nova demanda
      if (created?.demand) {
        void notifyAssigned(created.demand);
      }
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
            {kind === "sql" ? (
              /* SQL: dropdown de tipos pre-definidos (vira o title) */
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo de execução *</label>
                <Select value={title} onValueChange={setTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de execução..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Destaques no topo */}
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      Mais comuns
                    </div>
                    {SQL_EXECUTION_TYPES_PRIMARY.map((t) => (
                      <SelectItem key={t} value={t} className="font-semibold">
                        {t}
                      </SelectItem>
                    ))}
                    <div className="border-t my-1" />
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      Outros
                    </div>
                    {SQL_EXECUTION_TYPES_OTHERS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Use o campo "Descrição" abaixo pra detalhes (tabela, colunas, contexto).
                </p>
              </div>
            ) : (
              /* Deploy: titulo livre */
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Título *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Deploy v2.4.1 — release patch"
                  maxLength={150}
                  autoFocus
                />
              </div>
            )}

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
                <label className="text-sm font-medium">
                  Data limite
                  {!dueDate && autoDueDate && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                      (auto: {fmtPreview(autoDueDate)})
                    </span>
                  )}
                </label>
                <Input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder={autoDueDate ? toLocalInputValue(autoDueDate) : ""}
                />
                <p className="text-[10px] text-muted-foreground">
                  Preenchido automaticamente pela prioridade (P{priority.slice(1)} = {PRIORITY_CONFIG[priority]?.sla?.resolution ?? "—"} úteis). Sobrescreva se precisar.
                </p>
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

            {/* Banco de dados (disponivel pros 2 tipos) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Banco de Dados (opcional)</label>
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

            {/* Query SQL (so SQL — deploy nao tem query) */}
            {kind === "sql" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Query SQL (opcional)</label>
                  {query.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyQuery}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <Copy size={12} /> Copiar
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

            {/* Anexos (ambos os tipos) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Paperclip size={12} /> Anexos (opcional)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachments.length >= MAX_FILES}
                  className="h-7 text-xs"
                >
                  <Paperclip size={12} className="mr-1" /> Anexar
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFileSelect(e.target.files);
                  e.target.value = "";
                }}
              />
              {attachments.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Máximo {MAX_FILES} arquivos · 5MB por arquivo
                </p>
              ) : (
                <div className="space-y-1">
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 border rounded text-xs"
                    >
                      <FileText size={12} className="text-muted-foreground shrink-0" />
                      <span className="truncate flex-1" title={a.name}>{a.name}</span>
                      <span className="text-muted-foreground text-[10px] shrink-0">
                        {formatBytes(a.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        title="Remover"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">
                    {attachments.length}/{MAX_FILES} arquivos
                  </p>
                </div>
              )}
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
