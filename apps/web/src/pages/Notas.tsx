/**
 * /notas — Bloco de notas pessoal do usuario.
 *
 * Duas visualizacoes:
 * - Kanban (3 colunas: A fazer / Fazendo / Feito)
 * - Lista (vertical compacta, ordenada por updatedAt desc)
 *
 * Cada nota: titulo + conteudo (multiline) + tags + cor + status.
 * Persistencia via apiClient.notes (data/notes.json no servidor).
 *
 * Drag and drop nao tem dependencia externa — usar botoes "mover" no menu
 * da nota mantem simples e funcional em mobile/desktop.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  StickyNote, Plus, Search, MoreHorizontal, Pencil, Trash2,
  ArrowRight, ArrowLeft, Loader2, LayoutGrid, List as ListIcon, Tag, X,
  CheckSquare, Square,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/apiClient";
import {
  Note, NoteStatus, ChecklistItem, STATUS_LABELS, STATUS_ORDER,
  NOTE_COLORS, colorBgClass, newChecklistItem,
} from "@/types/note";

type View = "kanban" | "list";

interface EditorState {
  open: boolean;
  /** null = criando nova; Note = editando */
  note: Note | null;
  /** Pre-fill de status quando clica "Adicionar" numa coluna do kanban */
  defaultStatus?: NoteStatus;
}

const Notas = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const email = currentUser?.email || "";

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ open: false, note: null });
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);

  // Flag pra evitar atropelar o estado local enquanto o editor esta aberto
  // (senao polling poderia sobrescrever titulo/conteudo que o user esta editando).
  const editorOpenRef = useRef(false);
  useEffect(() => { editorOpenRef.current = editor.open; }, [editor.open]);

  const reload = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!email) return;
    if (opts.silent && editorOpenRef.current) return; // nao mexe enquanto edita
    if (!opts.silent) setLoading(true);
    try {
      const r = await apiClient.notes.list(email);
      setNotes(r.notes || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isAuth = /unauthorized|401/i.test(msg);
      if (!opts.silent && !isAuth) {
        toast({
          title: "Erro ao carregar notas",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [email, toast]);

  // Primeira carga
  useEffect(() => { void reload(); }, [reload]);

  // Auto-refresh a cada 10s — sincroniza notas entre abas/dispositivos.
  // Silencioso e pausa enquanto o editor esta aberto.
  useEffect(() => {
    const id = setInterval(() => { void reload({ silent: true }); }, 10_000);
    return () => clearInterval(id);
  }, [reload]);

  // Tags unicas pro filtro
  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (tagFilter && !n.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, search, tagFilter]);

  const byStatus = useMemo(() => {
    const m: Record<NoteStatus, Note[]> = { todo: [], doing: [], done: [] };
    filtered.forEach((n) => m[n.status]?.push(n));
    // List view: ordena por updatedAt desc; Kanban mantem order
    if (view === "list") {
      (Object.keys(m) as NoteStatus[]).forEach((s) => {
        m[s].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    }
    return m;
  }, [filtered, view]);

  /** Toggle de item de checklist direto no card (sem abrir editor) */
  const handleToggleItem = async (note: Note, itemId: string) => {
    const items = (note.items || []).map((it) =>
      it.id === itemId ? { ...it, done: !it.done } : it
    );
    // Optimistic
    setNotes((prev) => prev.map((x) => (x.id === note.id ? { ...x, items } : x)));
    try {
      await apiClient.notes.update(note.id, email, { items });
    } catch {
      toast({ title: "Erro ao atualizar item", variant: "destructive" });
      void reload();
    }
  };

  const handleMove = async (n: Note, dir: -1 | 1) => {
    const idx = STATUS_ORDER.indexOf(n.status);
    const next = STATUS_ORDER[idx + dir];
    if (!next) return;
    // Optimistic
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: next } : x)));
    try {
      await apiClient.notes.update(n.id, email, { status: next });
    } catch (e) {
      toast({ title: "Erro ao mover", variant: "destructive" });
      void reload();
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiClient.notes.remove(id, email);
      toast({ title: "Nota excluída" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
      void reload();
    }
  };

  const openCreate = (status?: NoteStatus) =>
    setEditor({ open: true, note: null, defaultStatus: status });
  const openEdit = (note: Note) => setEditor({ open: true, note });

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <StickyNote size={22} className="text-primary" /> Bloco de Notas
            </h1>
            <p className="text-sm text-muted-foreground">
              {notes.length === 0
                ? "Crie sua primeira nota"
                : `${notes.length} nota${notes.length !== 1 ? "s" : ""} · pessoal`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList className="h-9">
                <TabsTrigger value="kanban" className="gap-1.5">
                  <LayoutGrid size={14} /> Kanban
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5">
                  <ListIcon size={14} /> Lista
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" className="gap-2" onClick={() => openCreate()}>
              <Plus size={14} /> Nova nota
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar notas..."
              className="pl-9 h-9"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {allTags.slice(0, 10).map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                    tagFilter === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  #{t}
                </button>
              ))}
              {tagFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => setTagFilter(null)}
                >
                  <X size={12} /> Limpar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Conteudo */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : notes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <StickyNote size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Nenhuma nota ainda. Comece agora.
              </p>
              <Button size="sm" onClick={() => openCreate()} className="gap-1">
                <Plus size={14} /> Criar primeira nota
              </Button>
            </CardContent>
          </Card>
        ) : view === "kanban" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STATUS_ORDER.map((s) => (
              <KanbanColumn
                key={s}
                status={s}
                notes={byStatus[s]}
                onAdd={() => openCreate(s)}
                onEdit={openEdit}
                onMove={handleMove}
                onDelete={(n) => setConfirmDelete(n)}
                onToggleItem={handleToggleItem}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {STATUS_ORDER.map((s) => (
              byStatus[s].length === 0 ? null : (
                <div key={s}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {STATUS_LABELS[s]} <span className="text-[10px]">({byStatus[s].length})</span>
                  </h3>
                  <div className="space-y-2">
                    {byStatus[s].map((n) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        compact
                        onEdit={() => openEdit(n)}
                        onMove={handleMove}
                        onDelete={() => setConfirmDelete(n)}
                        onToggleItem={handleToggleItem}
                      />
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Editor (criar/editar) */}
      <NoteEditor
        state={editor}
        userEmail={email}
        onClose={() => setEditor({ open: false, note: null })}
        onSaved={() => { setEditor({ open: false, note: null }); void reload(); }}
      />

      {/* Confirmacao delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir nota?</DialogTitle>
            <DialogDescription>
              "{confirmDelete?.title}" será excluída permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

// ============= Kanban Column =============

interface KanbanColumnProps {
  status: NoteStatus;
  notes: Note[];
  onAdd: () => void;
  onEdit: (n: Note) => void;
  onMove: (n: Note, dir: -1 | 1) => void;
  onDelete: (n: Note) => void;
  onToggleItem: (n: Note, itemId: string) => void;
}

function KanbanColumn({ status, notes, onAdd, onEdit, onMove, onDelete, onToggleItem }: KanbanColumnProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-2 min-h-[200px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {STATUS_LABELS[status]}
          </span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {notes.length}
          </span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onAdd} title="Adicionar nota">
          <Plus size={14} />
        </Button>
      </div>
      <div className="space-y-2">
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            onEdit={() => onEdit(n)}
            onMove={onMove}
            onDelete={() => onDelete(n)}
            onToggleItem={onToggleItem}
          />
        ))}
        {notes.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-6 px-2">
            Sem notas aqui ainda
          </div>
        )}
      </div>
    </div>
  );
}

// ============= NoteCard =============

interface NoteCardProps {
  note: Note;
  compact?: boolean;
  onEdit: () => void;
  onMove: (n: Note, dir: -1 | 1) => void;
  onDelete: () => void;
  onToggleItem: (n: Note, itemId: string) => void;
}

function NoteCard({ note, compact, onEdit, onMove, onDelete, onToggleItem }: NoteCardProps) {
  const idx = STATUS_ORDER.indexOf(note.status);
  const canLeft = idx > 0;
  const canRight = idx < STATUS_ORDER.length - 1;
  const items = note.items || [];
  const doneCount = items.filter((i) => i.done).length;
  const progressPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <Card
      className={`${colorBgClass(note.color)} hover:shadow-sm transition-shadow cursor-pointer group`}
      onClick={onEdit}
    >
      <CardContent className={compact ? "p-2.5" : "p-3"}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm flex-1 truncate">{note.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5 rounded"
              >
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil size={12} className="mr-2" /> Editar
              </DropdownMenuItem>
              {canLeft && (
                <DropdownMenuItem onClick={() => onMove(note, -1)}>
                  <ArrowLeft size={12} className="mr-2" /> Mover ← {STATUS_LABELS[STATUS_ORDER[idx - 1]]}
                </DropdownMenuItem>
              )}
              {canRight && (
                <DropdownMenuItem onClick={() => onMove(note, 1)}>
                  <ArrowRight size={12} className="mr-2" /> Mover → {STATUS_LABELS[STATUS_ORDER[idx + 1]]}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 size={12} className="mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {note.content && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
            {note.content}
          </p>
        )}
        {items.length > 0 && (
          <div className="mt-2 space-y-1">
            {/* Progress bar */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{doneCount}/{items.length}</span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            {/* Lista (mostra ate 5 no card; resto so no editor) */}
            <ul className="space-y-0.5">
              {items.slice(0, 5).map((it) => (
                <li key={it.id} className="flex items-start gap-1.5 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleItem(note, it.id);
                    }}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                    aria-label={it.done ? "Desmarcar" : "Marcar"}
                  >
                    {it.done ? <CheckSquare size={12} className="text-primary" /> : <Square size={12} />}
                  </button>
                  <span className={`flex-1 truncate ${it.done ? "line-through text-muted-foreground" : ""}`}>
                    {it.text}
                  </span>
                </li>
              ))}
              {items.length > 5 && (
                <li className="text-[10px] text-muted-foreground pl-5">
                  +{items.length - 5} item{items.length - 5 > 1 ? "s" : ""}...
                </li>
              )}
            </ul>
          </div>
        )}
        {note.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {note.tags.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                #{t}
              </Badge>
            ))}
            {note.tags.length > 4 && (
              <span className="text-[9px] text-muted-foreground">+{note.tags.length - 4}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============= NoteEditor (Dialog criar/editar) =============

interface NoteEditorProps {
  state: EditorState;
  userEmail: string;
  onClose: () => void;
  onSaved: () => void;
}

function NoteEditor({ state, userEmail, onClose, onSaved }: NoteEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<NoteStatus>("todo");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [color, setColor] = useState<string>("default");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [itemInput, setItemInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (!state.open) return;
    if (state.note) {
      setTitle(state.note.title);
      setContent(state.note.content);
      setStatus(state.note.status);
      setTags(state.note.tags);
      setColor(state.note.color || "default");
      setItems(state.note.items || []);
    } else {
      setTitle("");
      setContent("");
      setStatus(state.defaultStatus || "todo");
      setTags([]);
      setColor("default");
      setItems([]);
    }
    setTagInput("");
    setItemInput("");
  }, [state]);

  const addItem = () => {
    const t = itemInput.trim();
    if (!t) return;
    setItems([...items, newChecklistItem(t)]);
    setItemInput("");
  };

  const toggleItem = (id: string) =>
    setItems(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));

  const removeItem = (id: string) =>
    setItems(items.filter((it) => it.id !== id));

  const updateItemText = (id: string, text: string) =>
    setItems(items.map((it) => (it.id === id ? { ...it, text } : it)));

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (state.note) {
        await apiClient.notes.update(state.note.id, userEmail, {
          title: title.trim(),
          content,
          status,
          tags,
          color: color === "default" ? null : color,
          items,
        });
        toast({ title: "Nota atualizada" });
      } else {
        await apiClient.notes.create({
          userEmail,
          title: title.trim(),
          content,
          status,
          tags,
          color: color === "default" ? null : color,
          items,
        });
        toast({ title: "Nota criada" });
      }
      onSaved();
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{state.note ? "Editar nota" : "Nova nota"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Revisar PR do módulo X"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Conteúdo</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Detalhes, checklist, links..."
              rows={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <div className="flex gap-1">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`text-xs px-2 py-1.5 rounded border flex-1 transition-colors ${
                      status === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 hover:bg-muted border-border"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
              <div className="flex gap-1 flex-wrap">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className={`w-7 h-7 rounded border-2 transition-all ${c.bg} ${
                      color === c.value ? "border-primary scale-110" : "border-border"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              <CheckSquare size={11} className="inline mr-1" /> Lista de itens
              {items.length > 0 && (
                <span className="ml-2 text-[10px]">
                  ({items.filter((i) => i.done).length}/{items.length})
                </span>
              )}
            </label>
            {items.length > 0 && (
              <ul className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleItem(it.id)}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      aria-label={it.done ? "Desmarcar" : "Marcar"}
                    >
                      {it.done ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                    </button>
                    <Input
                      value={it.text}
                      onChange={(e) => updateItemText(it.id, e.target.value)}
                      className={`h-7 text-xs flex-1 ${it.done ? "line-through text-muted-foreground" : ""}`}
                    />
                    <button
                      onClick={() => removeItem(it.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      aria-label="Remover item"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={itemInput}
                onChange={(e) => setItemInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addItem(); }
                }}
                placeholder="Adicionar item da lista..."
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={addItem} className="h-8 gap-1">
                <Plus size={12} /> Item
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              <Tag size={11} className="inline mr-1" /> Tags
            </label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] gap-1 pr-1">
                  #{t}
                  <button onClick={() => removeTag(t)} className="hover:text-destructive">
                    <X size={10} />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                }}
                placeholder="ex: ideias, urgente"
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={addTag} className="h-8">
                Adicionar
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {state.note ? "Salvar" : "Criar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Notas;
