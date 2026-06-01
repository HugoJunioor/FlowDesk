/**
 * Modal pra abrir uma nova demanda interna.
 *
 * Tabs SQL | Deploy | Suporte. SQL e Deploy reusam o formulario original.
 * Suporte tem campos estruturados: contexto, aconteceu, impacto, quem olhar,
 * proximo passo, info adicionais — montados em description no submit.
 * Responsavel default = Operador Infra.
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
import { Database, Rocket, Loader2, Copy, Plus, ExternalLink, Paperclip, X, FileText, Headphones, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { loadInfraDatabases, addInfraDatabase } from "@/lib/infraDatabases";
import { addBusinessHours } from "@/lib/businessHours";
import { PRIORITY_CONFIG } from "@/types/demand";
import { notifyAssigned } from "@/lib/notificationEvents";
import { getAllUsers } from "@/lib/authStorage";

interface NewDemandaInternaModalProps {
  open: boolean;
  defaultKind: "sql" | "deploy" | "suporte";
  onClose: () => void;
  onCreated: () => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 5;

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

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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


const NewDemandaInternaModal = ({ open, defaultKind, onClose, onCreated }: NewDemandaInternaModalProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [kind, setKind] = useState<"sql" | "deploy" | "suporte">(defaultKind);
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
  const [attachments, setAttachments] = useState<InfraAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campos Suporte-specific
  const [suporteContexto, setSuporteContexto] = useState("");
  const [suporteAconteceu, setSuporteAconteceu] = useState("");
  const [suporteImpactoNivel, setSuporteImpactoNivel] = useState<"baixo" | "medio" | "alto">("medio");
  const [suporteImpactoDescricao, setSuporteImpactoDescricao] = useState("");
  const [suporteQuemOlhar, setSuporteQuemOlhar] = useState<string[]>([]);
  const [suporteProximoPasso, setSuporteProximoPasso] = useState("");
  const [suporteInfoAdicionais, setSuporteInfoAdicionais] = useState("");
  // Lista de usuarios do sistema (para o campo "Quem precisa olhar").
  // Atualiza sempre que o modal abre — captura novos cadastros sem F5.
  const [systemUsers, setSystemUsers] = useState<Array<{ name: string; email: string }>>([]);
  const [suporteUserSearch, setSuporteUserSearch] = useState("");

  const autoDueDate = (() => {
    const cfg = PRIORITY_CONFIG[priority];
    if (!cfg?.sla) return null;
    return addBusinessHours(new Date(), cfg.sla.resolutionHours);
  })();

  const refreshDatabases = useCallback(() => {
    setDatabases(loadInfraDatabases());
  }, []);

  const resetForm = useCallback(() => {
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
    setSuporteContexto("");
    setSuporteAconteceu("");
    setSuporteImpactoNivel("medio");
    setSuporteImpactoDescricao("");
    setSuporteQuemOlhar([]);
    setSuporteProximoPasso("");
    setSuporteInfoAdicionais("");
  }, []);

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      resetForm();
      refreshDatabases();
      // Carrega usuarios cadastrados — re-le toda vez que abre pra capturar
      // novos cadastros (UserManagement) sem precisar de refresh.
      try {
        const users = getAllUsers()
          .filter((u) => u.active !== false)
          .map((u) => ({ name: u.name, email: u.email }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSystemUsers(users);
      } catch {
        setSystemUsers([]);
      }
      setSuporteUserSearch("");
    }
  }, [open, defaultKind, resetForm, refreshDatabases]);

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
          description: `${file.name}: ${formatBytes(file.size)} (máx 25MB)`,
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
      } catch {
        toast({ title: "Erro ao ler arquivo", description: file.name, variant: "destructive" });
      }
    }
    if (accepted.length > 0) setAttachments((prev) => [...prev, ...accepted]);
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
    if (!name) { setShowAddDbInput(false); return; }
    const updated = addInfraDatabase(name);
    setDatabases(updated);
    setDatabase(name);
    setNewDbName("");
    setShowAddDbInput(false);
    toast({ title: "Banco adicionado", description: name });
  };

  const toggleMember = (member: string) => {
    setSuporteQuemOlhar((prev) =>
      prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
    );
  };

  /** Monta description estruturada para demanda de Suporte */
  const buildSuporteDescription = (): string => {
    const impactoMap = { baixo: "Baixo", medio: "Médio", alto: "Alto" };
    const mentions = suporteQuemOlhar.map((m) => `@${m}`).join(" ");
    const lines = [
      `Contexto: ${suporteContexto}`,
      `O que aconteceu: ${suporteAconteceu}`,
      `Impacto: ${impactoMap[suporteImpactoNivel]}${suporteImpactoDescricao ? `, ${suporteImpactoDescricao}` : ""}`,
      mentions ? `Quem precisa olhar: ${mentions}` : null,
      `Próximo passo: ${suporteProximoPasso}`,
      suporteInfoAdicionais ? suporteInfoAdicionais : null,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleSubmit = async () => {
    const isSuporteValid =
      kind === "suporte" && title.trim() && suporteContexto.trim() && suporteAconteceu.trim() && suporteProximoPasso.trim();
    const isOtherValid = kind !== "suporte" && title.trim();

    if (!isSuporteValid && !isOtherValid) {
      if (kind === "suporte") {
        toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      } else {
        toast({ title: "Título obrigatório", variant: "destructive" });
      }
      return;
    }

    setSaving(true);
    try {
      const finalDueDate = dueDate
        ? new Date(dueDate).toISOString()
        : autoDueDate
        ? autoDueDate.toISOString()
        : null;

      const finalDescription =
        kind === "suporte" ? buildSuporteDescription() : description.trim() || undefined;

      const created = await apiClient.infra.create({
        title: title.trim(),
        description: finalDescription,
        priority,
        infraKind: kind,
        requester: {
          name: currentUser?.name || currentUser?.login || "Anônimo",
          avatar: "",
        },
        assignee: { name: "Operador Infra", avatar: "" },
        dueDate: finalDueDate,
        client: client.trim() || undefined,
        infraQuery: kind === "sql" && query.trim() ? query.trim() : undefined,
        infraDatabase: database || undefined,
        infraExternalLink: externalLink.trim() || undefined,
        ...(attachments.length > 0 ? { infraAttachments: attachments } : {}),
        // Campos estruturados do Suporte (persistidos individualmente tambem)
        ...(kind === "suporte" ? {
          infraSuporteContexto: suporteContexto.trim() || undefined,
          infraSuporteAconteceu: suporteAconteceu.trim() || undefined,
          infraSuporteImpactoNivel: suporteImpactoNivel,
          infraSuporteImpactoDescricao: suporteImpactoDescricao.trim() || undefined,
          infraSuporteQuemOlhar: suporteQuemOlhar.length > 0 ? suporteQuemOlhar : undefined,
          infraSuporteProximoPasso: suporteProximoPasso.trim() || undefined,
          infraSuporteInfoAdicionais: suporteInfoAdicionais.trim() || undefined,
        } : {}),
      });

      if (created?.demand) void notifyAssigned(created.demand);

      const kindLabel = kind === "sql" ? "Operações SQL" : kind === "deploy" ? "Deploy" : "Suporte";
      toast({
        title: `Demanda de ${kindLabel} criada`,
        description: "Atribuída a Operador Infra.",
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

  const isSubmitDisabled = saving || (
    kind === "suporte"
      ? !title.trim() || !suporteContexto.trim() || !suporteAconteceu.trim() || !suporteProximoPasso.trim()
      : !title.trim()
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova demanda interna</DialogTitle>
          <DialogDescription>
            Demandas internas atendidas pelo time. Responsável padrão: <strong>Operador Infra</strong>.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(v) => setKind(v as "sql" | "deploy" | "suporte")}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="sql" className="gap-2">
              <Database size={14} /> SQL
            </TabsTrigger>
            <TabsTrigger value="deploy" className="gap-2">
              <Rocket size={14} /> Deploy
            </TabsTrigger>
            <TabsTrigger value="suporte" className="gap-2">
              <Headphones size={14} /> Suporte
            </TabsTrigger>
          </TabsList>

          {/* SQL tab */}
          <TabsContent value="sql" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de execução *</label>
              <Select value={title} onValueChange={setTitle}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de execução..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    Mais comuns
                  </div>
                  {SQL_EXECUTION_TYPES_PRIMARY.map((t) => (
                    <SelectItem key={t} value={t} className="font-semibold">{t}</SelectItem>
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
            </div>
            {renderCommonFields()}
          </TabsContent>

          {/* Deploy tab */}
          <TabsContent value="deploy" className="space-y-4 mt-4">
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
            {renderCommonFields()}
          </TabsContent>

          {/* Suporte tab */}
          <TabsContent value="suporte" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: [VSPAY] ERRO AO REALIZAR LOGIN NO APP"
                maxLength={150}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                Formato sugerido: [CLIENTE] DESCRIÇÃO EM MAIÚSCULAS
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Contexto *</label>
              <Textarea
                value={suporteContexto}
                onChange={(e) => setSuporteContexto(e.target.value)}
                placeholder="Contexto geral da situação"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">O que aconteceu *</label>
              <Textarea
                value={suporteAconteceu}
                onChange={(e) => setSuporteAconteceu(e.target.value)}
                placeholder="Descreva o problema ou incidente"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Impacto *</label>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={suporteImpactoNivel}
                  onValueChange={(v) => setSuporteImpactoNivel(v as "baixo" | "medio" | "alto")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={suporteImpactoDescricao}
                  onChange={(e) => setSuporteImpactoDescricao(e.target.value)}
                  placeholder="Descrição do impacto"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Quem precisa olhar{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  ({systemUsers.length} usuários cadastrados)
                </span>
              </label>

              {/* Selecionados (aparecem em destaque, removiveis) */}
              {suporteQuemOlhar.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/20">
                  {suporteQuemOlhar.map((m) => (
                    <button
                      key={`sel-${m}`}
                      type="button"
                      onClick={() => toggleMember(m)}
                      className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground inline-flex items-center gap-1 hover:bg-primary/90"
                      title="Remover"
                    >
                      @{m} <X size={10} />
                    </button>
                  ))}
                </div>
              )}

              {/* Caixa de busca + listagem dos usuarios do sistema */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  value={suporteUserSearch}
                  onChange={(e) => setSuporteUserSearch(e.target.value)}
                  placeholder={
                    systemUsers.length === 0
                      ? "Nenhum usuário cadastrado — cadastre em Usuários"
                      : "Buscar usuário pelo nome ou e-mail..."
                  }
                  className="pl-7 h-8 text-xs"
                  disabled={systemUsers.length === 0}
                />
              </div>

              <div className="max-h-44 overflow-y-auto rounded-md border bg-muted/20 divide-y divide-border/40">
                {systemUsers
                  .filter((u) => {
                    const q = suporteUserSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      u.name.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q)
                    );
                  })
                  .map((u) => {
                    const selected = suporteQuemOlhar.includes(u.name);
                    return (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => toggleMember(u.name)}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                          selected
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                              selected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/40"
                            }`}
                          >
                            {selected && <span className="text-[10px] leading-none">✓</span>}
                          </span>
                          <span className="font-medium">{u.name}</span>
                        </span>
                        <span className="text-muted-foreground text-[10px]">{u.email}</span>
                      </button>
                    );
                  })}
                {systemUsers.length > 0 &&
                  systemUsers.filter((u) => {
                    const q = suporteUserSearch.trim().toLowerCase();
                    if (!q) return true;
                    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                  }).length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                      Nenhum usuário com "{suporteUserSearch}"
                    </div>
                  )}
                {systemUsers.length === 0 && (
                  <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                    Cadastre usuários em /usuarios pra que apareçam aqui.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Próximo passo *</label>
              <Textarea
                value={suporteProximoPasso}
                onChange={(e) => setSuporteProximoPasso(e.target.value)}
                placeholder="O que deve ser feito a seguir"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Informações adicionais (opcional)</label>
              <Textarea
                value={suporteInfoAdicionais}
                onChange={(e) => setSuporteInfoAdicionais(e.target.value)}
                placeholder={"- Info 1\n- Info 2"}
                rows={3}
              />
            </div>

            {/* Prioridade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as "p1" | "p2" | "p3")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                />
              </div>
            </div>

            {/* Link da demanda */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <ExternalLink size={12} /> Link relevante (opcional)
              </label>
              <Input
                type="url"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Anexos */}
            {renderAttachments()}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled} className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Abrir demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  /** Campos comuns a SQL e Deploy */
  function renderCommonFields() {
    return (
      <>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              Preenchido automaticamente pela prioridade (P{priority.slice(1)} = {PRIORITY_CONFIG[priority]?.sla?.resolution ?? "—"} úteis).
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

        {/* Banco de dados */}
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
              <Button type="button" onClick={handleAddDatabase} size="sm">Adicionar</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddDbInput(false); setNewDbName(""); }}>Cancelar</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={database} onValueChange={setDatabase}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um banco..." />
                </SelectTrigger>
                <SelectContent>
                  {databases.length === 0 ? (
                    <div className="py-2 px-3 text-xs text-muted-foreground">Nenhum banco cadastrado</div>
                  ) : (
                    databases.map((db) => <SelectItem key={db} value={db}>{db}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddDbInput(true)} className="gap-1.5">
                <Plus size={14} /> Novo
              </Button>
            </div>
          )}
        </div>

        {/* Query SQL */}
        {kind === "sql" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Query SQL (opcional)</label>
              {query.trim() && (
                <Button type="button" variant="ghost" size="sm" onClick={handleCopyQuery} className="h-7 gap-1.5 text-xs">
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

        {/* Link */}
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

        {renderAttachments()}
      </>
    );
  }

  function renderAttachments() {
    return (
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
          onChange={(e) => { void handleFileSelect(e.target.files); e.target.value = ""; }}
        />
        {attachments.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Máximo {MAX_FILES} arquivos · 25MB por arquivo</p>
        ) : (
          <div className="space-y-1">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 border rounded text-xs">
                <FileText size={12} className="text-muted-foreground shrink-0" />
                <span className="truncate flex-1" title={a.name}>{a.name}</span>
                <span className="text-muted-foreground text-[10px] shrink-0">{formatBytes(a.size)}</span>
                <button type="button" onClick={() => removeAttachment(a.id)} className="text-muted-foreground hover:text-destructive shrink-0" title="Remover">
                  <X size={12} />
                </button>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">{attachments.length}/{MAX_FILES} arquivos</p>
          </div>
        )}
      </div>
    );
  }
};

export default NewDemandaInternaModal;
