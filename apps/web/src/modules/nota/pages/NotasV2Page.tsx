/**
 * /notas — Bloco de notas pessoal (modulo padrao Just).
 *
 * Funcionalidades:
 * - Toggle kanban (3 colunas: A fazer / Fazendo / Feito) / lista
 * - Busca por titulo, conteudo e tags
 * - Filtro por tag
 * - Seletor de 8 cores predefinidas
 * - Checklist items com toggle inline no card
 * - Botoes mover entre status no menu do card
 * - Editor dialog completo para criar e editar
 * - Soft delete com confirmacao
 *
 * Persistencia via API Express /api/v1/notas (padrao Just).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Square,
  StickyNote,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useNotas,
  useCreateNota,
  useUpdateNota,
  useRemoveNota,
  NOTE_STATUSES,
  type Nota,
  type NoteStatus,
  type ChecklistItem,
} from '@/modules/nota';
import { toApiError } from '@/lib/api/client';

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<NoteStatus, string> = {
  todo: 'A fazer',
  doing: 'Fazendo',
  done: 'Feito',
};

interface NoteColor {
  value: string;
  name: string;
  bg: string;
}

const NOTE_COLORS: NoteColor[] = [
  { value: 'default', name: 'Padrão', bg: 'bg-card' },
  { value: 'yellow', name: 'Amarelo', bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
  { value: 'blue', name: 'Azul', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  { value: 'green', name: 'Verde', bg: 'bg-green-50 dark:bg-green-950/40' },
  { value: 'red', name: 'Vermelho', bg: 'bg-red-50 dark:bg-red-950/40' },
  { value: 'purple', name: 'Roxo', bg: 'bg-purple-50 dark:bg-purple-950/40' },
  { value: 'orange', name: 'Laranja', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  { value: 'pink', name: 'Rosa', bg: 'bg-pink-50 dark:bg-pink-950/40' },
];

function colorBgClass(cor: string | null): string {
  if (!cor || cor === 'default') return '';
  return NOTE_COLORS.find((c) => c.value === cor)?.bg ?? '';
}

function newItem(texto: string): { id: string; texto: string; feito: boolean } {
  return { id: crypto.randomUUID(), texto, feito: false };
}

type View = 'kanban' | 'list';

interface EditorState {
  open: boolean;
  nota: Nota | null;
  defaultStatus?: NoteStatus;
}

// ─── Page ───────────────────────────────────────────────────────────────────────

const NotasV2Page = () => {
  const { toast } = useToast();
  const { data: notas = [], isLoading, error } = useNotas();
  const updateMutation = useUpdateNota();
  const removeMutation = useRemoveNota();

  const [view, setView] = useState<View>('kanban');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ open: false, nota: null });
  const [confirmDelete, setConfirmDelete] = useState<Nota | null>(null);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    notas.forEach((n) => n.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [notas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notas.filter((n) => {
      if (tagFilter && !n.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        n.titulo.toLowerCase().includes(q) ||
        n.conteudo.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notas, search, tagFilter]);

  const byStatus = useMemo(() => {
    const m: Record<NoteStatus, Nota[]> = { todo: [], doing: [], done: [] };
    filtered.forEach((n) => m[n.status]?.push(n));
    if (view === 'list') {
      (Object.keys(m) as NoteStatus[]).forEach((s) => {
        m[s].sort(
          (a, b) =>
            new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime(),
        );
      });
    }
    return m;
  }, [filtered, view]);

  const handleToggleItem = useCallback(
    async (nota: Nota, itemId: string) => {
      const items = nota.items.map((it) =>
        it.id === itemId
          ? { id: it.id, texto: it.texto, feito: !it.feito }
          : { id: it.id, texto: it.texto, feito: it.feito },
      );
      try {
        await updateMutation.mutateAsync({ id: nota.id, input: { items } });
      } catch {
        toast({ title: 'Erro ao atualizar item', variant: 'destructive' });
      }
    },
    [updateMutation, toast],
  );

  const handleMove = useCallback(
    async (nota: Nota, dir: -1 | 1) => {
      const idx = NOTE_STATUSES.indexOf(nota.status);
      const next = NOTE_STATUSES[idx + dir];
      if (!next) return;
      try {
        await updateMutation.mutateAsync({ id: nota.id, input: { status: next } });
      } catch {
        toast({ title: 'Erro ao mover nota', variant: 'destructive' });
      }
    },
    [updateMutation, toast],
  );

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    const titulo = confirmDelete.titulo;
    setConfirmDelete(null);
    try {
      await removeMutation.mutateAsync(id);
      toast({ title: `"${titulo}" excluída` });
    } catch {
      toast({ title: 'Erro ao excluir nota', variant: 'destructive' });
    }
  };

  const openCreate = (status?: NoteStatus) =>
    setEditor({ open: true, nota: null, defaultStatus: status });
  const openEdit = (nota: Nota) => setEditor({ open: true, nota });

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
              {notas.length === 0
                ? 'Crie sua primeira nota'
                : `${notas.length} nota${notas.length !== 1 ? 's' : ''} · pessoal`}
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
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
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
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive text-sm">
              {toApiError(error).message}
            </CardContent>
          </Card>
        ) : notas.length === 0 ? (
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
        ) : view === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {NOTE_STATUSES.map((s) => (
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
            {NOTE_STATUSES.map((s) =>
              byStatus[s].length === 0 ? null : (
                <div key={s}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {STATUS_LABELS[s]}{' '}
                    <span className="text-[10px]">({byStatus[s].length})</span>
                  </h3>
                  <div className="space-y-2">
                    {byStatus[s].map((n) => (
                      <NoteCard
                        key={n.id}
                        nota={n}
                        compact
                        onEdit={() => openEdit(n)}
                        onMove={handleMove}
                        onDelete={() => setConfirmDelete(n)}
                        onToggleItem={handleToggleItem}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Editor */}
      <NoteEditor
        state={editor}
        onClose={() => setEditor({ open: false, nota: null })}
        onSaved={() => setEditor({ open: false, nota: null })}
      />

      {/* Confirmacao delete */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir nota?</DialogTitle>
            <DialogDescription>
              &ldquo;{confirmDelete?.titulo}&rdquo; será excluída permanentemente. Esta ação
              não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={handleDelete}
            >
              {removeMutation.isPending && (
                <Loader2 size={14} className="animate-spin mr-2" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

// ─── KanbanColumn ───────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: NoteStatus;
  notes: Nota[];
  onAdd: () => void;
  onEdit: (n: Nota) => void;
  onMove: (n: Nota, dir: -1 | 1) => void;
  onDelete: (n: Nota) => void;
  onToggleItem: (n: Nota, itemId: string) => void;
}

function KanbanColumn({
  status,
  notes,
  onAdd,
  onEdit,
  onMove,
  onDelete,
  onToggleItem,
}: KanbanColumnProps) {
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
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onAdd}
          title="Adicionar nota"
        >
          <Plus size={14} />
        </Button>
      </div>
      <div className="space-y-2">
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            nota={n}
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

// ─── NoteCard ───────────────────────────────────────────────────────────────────

interface NoteCardProps {
  nota: Nota;
  compact?: boolean;
  onEdit: () => void;
  onMove: (n: Nota, dir: -1 | 1) => void;
  onDelete: () => void;
  onToggleItem: (n: Nota, itemId: string) => void;
}

function NoteCard({ nota, compact, onEdit, onMove, onDelete, onToggleItem }: NoteCardProps) {
  const idx = NOTE_STATUSES.indexOf(nota.status);
  const canLeft = idx > 0;
  const canRight = idx < NOTE_STATUSES.length - 1;
  const items: ChecklistItem[] = nota.items ?? [];
  const doneCount = items.filter((i) => i.feito).length;
  const progressPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <Card
      className={`${colorBgClass(nota.cor)} hover:shadow-sm transition-shadow cursor-pointer group`}
      onClick={onEdit}
    >
      <CardContent className={compact ? 'p-2.5' : 'p-3'}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm flex-1 truncate">{nota.titulo}</h4>
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
                <DropdownMenuItem onClick={() => onMove(nota, -1)}>
                  <ArrowLeft size={12} className="mr-2" /> Mover ←{' '}
                  {STATUS_LABELS[NOTE_STATUSES[idx - 1]]}
                </DropdownMenuItem>
              )}
              {canRight && (
                <DropdownMenuItem onClick={() => onMove(nota, 1)}>
                  <ArrowRight size={12} className="mr-2" /> Mover →{' '}
                  {STATUS_LABELS[NOTE_STATUSES[idx + 1]]}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={12} className="mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {nota.conteudo && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
            {nota.conteudo}
          </p>
        )}

        {items.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">
                {doneCount}/{items.length}
              </span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <ul className="space-y-0.5">
              {items.slice(0, 5).map((it) => (
                <li key={it.id} className="flex items-start gap-1.5 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void onToggleItem(nota, it.id);
                    }}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                    aria-label={it.feito ? 'Desmarcar' : 'Marcar'}
                  >
                    {it.feito ? (
                      <CheckSquare size={12} className="text-primary" />
                    ) : (
                      <Square size={12} />
                    )}
                  </button>
                  <span
                    className={`flex-1 truncate ${
                      it.feito ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {it.texto}
                  </span>
                </li>
              ))}
              {items.length > 5 && (
                <li className="text-[10px] text-muted-foreground pl-5">
                  +{items.length - 5} item{items.length - 5 > 1 ? 's' : ''}...
                </li>
              )}
            </ul>
          </div>
        )}

        {nota.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {nota.tags.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                #{t}
              </Badge>
            ))}
            {nota.tags.length > 4 && (
              <span className="text-[9px] text-muted-foreground">
                +{nota.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── NoteEditor ─────────────────────────────────────────────────────────────────

interface NoteEditorProps {
  state: EditorState;
  onClose: () => void;
  onSaved: () => void;
}

function NoteEditor({ state, onClose, onSaved }: NoteEditorProps) {
  const { toast } = useToast();
  const createMutation = useCreateNota();
  const updateMutation = useUpdateNota();

  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [status, setStatus] = useState<NoteStatus>('todo');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [cor, setCor] = useState<string>('default');
  const [items, setItems] = useState<Array<{ id: string; texto: string; feito: boolean }>>([]);
  const [itemInput, setItemInput] = useState('');

  // Reset ao abrir / trocar nota
  useEffect(() => {
    if (!state.open) return;
    if (state.nota) {
      setTitulo(state.nota.titulo);
      setConteudo(state.nota.conteudo);
      setStatus(state.nota.status);
      setTags(state.nota.tags);
      setCor(state.nota.cor ?? 'default');
      setItems(
        state.nota.items.map((it) => ({ id: it.id, texto: it.texto, feito: it.feito })),
      );
    } else {
      setTitulo('');
      setConteudo('');
      setStatus(state.defaultStatus ?? 'todo');
      setTags([]);
      setCor('default');
      setItems([]);
    }
    setTagInput('');
    setItemInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.nota?.id]);

  const saving = createMutation.isPending || updateMutation.isPending;

  const addItem = () => {
    const t = itemInput.trim();
    if (!t) return;
    setItems((prev) => [...prev, newItem(t)]);
    setItemInput('');
  };

  const toggleItem = (id: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, feito: !it.feito } : it)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const updateItemText = (id: string, texto: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, texto } : it)));

  const addTag = () => {
    const t = tagInput
      .trim()
      .replace(/^#/, '')
      .toLowerCase();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' });
      return;
    }
    const payload = {
      titulo: titulo.trim(),
      conteudo,
      status,
      tags,
      cor: cor === 'default' ? null : cor,
      items: items.map(({ id, texto, feito }) => ({ id, texto, feito })),
    };
    try {
      if (state.nota) {
        await updateMutation.mutateAsync({ id: state.nota.id, input: payload });
        toast({ title: 'Nota atualizada' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Nota criada' });
      }
      onSaved();
    } catch (e) {
      toast({
        title: 'Erro ao salvar',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state.nota ? 'Editar nota' : 'Nova nota'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Titulo */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Título</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Revisar PR do módulo X"
              autoFocus
            />
          </div>

          {/* Conteudo */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Conteúdo</label>
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Detalhes, links..."
              rows={4}
            />
          </div>

          {/* Status + Cor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <div className="flex gap-1">
                {NOTE_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`text-xs px-2 py-1.5 rounded border flex-1 transition-colors ${
                      status === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/30 hover:bg-muted border-border'
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
                    onClick={() => setCor(c.value)}
                    title={c.name}
                    className={`w-7 h-7 rounded border-2 transition-all ${c.bg} ${
                      cor === c.value ? 'border-primary scale-110' : 'border-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              <CheckSquare size={11} className="inline mr-1" /> Lista de itens
              {items.length > 0 && (
                <span className="ml-2 text-[10px]">
                  ({items.filter((i) => i.feito).length}/{items.length})
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
                      aria-label={it.feito ? 'Desmarcar' : 'Marcar'}
                    >
                      {it.feito ? (
                        <CheckSquare size={14} className="text-primary" />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                    <Input
                      value={it.texto}
                      onChange={(e) => updateItemText(it.id, e.target.value)}
                      className={`h-7 text-xs flex-1 ${
                        it.feito ? 'line-through text-muted-foreground' : ''
                      }`}
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
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Adicionar item da lista..."
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={addItem} className="h-8 gap-1">
                <Plus size={12} /> Item
              </Button>
            </div>
          </div>

          {/* Tags */}
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
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
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
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {state.nota ? 'Salvar' : 'Criar nota'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NotasV2Page;
