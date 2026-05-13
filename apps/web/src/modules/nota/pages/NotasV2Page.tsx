/**
 * /notas-v2 — Bloco de notas usando a API Express (padrao Just).
 *
 * Versao simplificada da pagina /notas legacy. Foca em CRUD basico +
 * checklist toggle. Kanban e drag-and-drop ficam pra evolucao futura.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  StickyNote, Plus, Loader2, Trash2, CheckSquare, Square, X,
} from 'lucide-react';
import {
  useNotas, useCreateNota, useUpdateNota, useRemoveNota,
  notaFormSchema, NOTE_STATUSES,
  type NotaFormValues, type Nota, type NoteStatus,
} from '@/modules/nota';
import { toApiError } from '@/lib/api/client';

const STATUS_LABELS: Record<NoteStatus, string> = {
  todo: 'A fazer',
  doing: 'Fazendo',
  done: 'Feito',
};

const NotasV2Page = () => {
  const { data: notas, isLoading, error } = useNotas();
  const createMutation = useCreateNota();
  const updateMutation = useUpdateNota();
  const removeMutation = useRemoveNota();
  const [showForm, setShowForm] = useState(false);

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<NotaFormValues>({
    resolver: zodResolver(notaFormSchema),
    defaultValues: { titulo: '', conteudo: '', status: 'todo', tags: [], cor: null },
  });

  const onSubmit = async (values: NotaFormValues): Promise<void> => {
    try {
      await createMutation.mutateAsync(values);
      reset();
      setShowForm(false);
    } catch {
      // Erro mostrado via createMutation.error
    }
  };

  const toggleItem = async (nota: Nota, itemId: string, feito: boolean): Promise<void> => {
    const items = nota.items.map((it) =>
      it.id === itemId ? { id: it.id, texto: it.texto, feito } : { id: it.id, texto: it.texto, feito: it.feito }
    );
    await updateMutation.mutateAsync({ id: nota.id, input: { items } });
  };

  const moveStatus = async (nota: Nota, status: NoteStatus): Promise<void> => {
    await updateMutation.mutateAsync({ id: nota.id, input: { status } });
  };

  const handleRemove = async (id: string): Promise<void> => {
    if (!confirm('Excluir esta nota?')) return;
    await removeMutation.mutateAsync(id);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <StickyNote size={22} className="text-primary" /> Notas (v2)
            </h1>
            <p className="text-sm text-muted-foreground">
              Versão via API REST · {notas?.length ?? 0} notas
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            className="gap-2"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Nova nota'}
          </Button>
        </div>

        {/* Form de criar */}
        {showForm && (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div>
                  <Input
                    placeholder="Título"
                    autoFocus
                    {...register('titulo')}
                    className={errors.titulo ? 'border-destructive' : ''}
                  />
                  {errors.titulo && (
                    <p className="text-xs text-destructive mt-1">{errors.titulo.message}</p>
                  )}
                </div>
                <Textarea
                  placeholder="Conteúdo (opcional)"
                  rows={3}
                  {...register('conteudo')}
                />
                {createMutation.error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {toApiError(createMutation.error).message}
                  </div>
                )}
                <Button type="submit" size="sm" disabled={createMutation.isPending} className="gap-2">
                  {createMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                  Criar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista */}
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
        ) : !notas || notas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma nota ainda. Clique em "Nova nota" pra começar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {notas.map((nota) => {
              const done = nota.items.filter((i) => i.feito).length;
              const total = nota.items.length;
              return (
                <Card key={nota.id} className="overflow-hidden">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm flex-1 truncate">{nota.titulo}</h3>
                      <button
                        onClick={() => void handleRemove(nota.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        aria-label="Excluir"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {nota.conteudo && (
                      <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                        {nota.conteudo}
                      </p>
                    )}
                    {total > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground">
                          {done}/{total}
                        </div>
                        <ul className="space-y-0.5">
                          {nota.items.slice(0, 5).map((it) => (
                            <li key={it.id} className="flex items-center gap-1.5 text-xs">
                              <button
                                onClick={() => void toggleItem(nota, it.id, !it.feito)}
                                className="text-muted-foreground hover:text-primary"
                                aria-label={it.feito ? 'Desmarcar' : 'Marcar'}
                              >
                                {it.feito
                                  ? <CheckSquare size={12} className="text-primary" />
                                  : <Square size={12} />}
                              </button>
                              <span className={`flex-1 truncate ${it.feito ? 'line-through text-muted-foreground' : ''}`}>
                                {it.texto}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center gap-1 pt-1">
                      {NOTE_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => void moveStatus(nota, s)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            nota.status === s
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/30 hover:bg-muted border-border text-muted-foreground'
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                    {nota.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {nota.tags.slice(0, 4).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                            #{t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          Esta tela usa a API Express. Versão legacy continua em <code>/notas</code>.
        </p>
      </div>
    </AppLayout>
  );
};

export default NotasV2Page;
