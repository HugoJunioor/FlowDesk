/**
 * CRUD de templates de resposta usados no DemandReplyComposer.
 * Storage: localStorage `fd_reply_templates` (via lib/replyTemplates).
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  type ReplyTemplate,
} from '@/lib/replyTemplates';

export default function ReplyTemplatesCard() {
  const { toast } = useToast();
  const [items, setItems] = useState<ReplyTemplate[]>([]);
  const [editing, setEditing] = useState<{ id?: string; name: string; body: string } | null>(null);

  function reload() {
    setItems(listTemplates());
  }

  useEffect(() => {
    reload();
  }, []);

  const startNew = () => setEditing({ name: '', body: '' });
  const startEdit = (t: ReplyTemplate) => setEditing({ id: t.id, name: t.name, body: t.body });
  const cancel = () => setEditing(null);

  const submit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    const body = editing.body.trim();
    if (!name || !body) {
      toast({ title: 'Preencha nome e conteúdo', variant: 'destructive' });
      return;
    }
    saveTemplate({ id: editing.id, name, body });
    setEditing(null);
    reload();
    toast({ title: editing.id ? 'Template atualizado' : 'Template criado' });
  };

  const remove = (t: ReplyTemplate) => {
    if (!window.confirm(`Excluir o template "${t.name}"?`)) return;
    deleteTemplate(t.id);
    reload();
    toast({ title: 'Template excluído' });
  };

  return (
    <Card id="templates" className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <CardTitle className="text-base font-semibold">Templates de resposta</CardTitle>
        </div>
        <CardDescription>
          Mensagens prontas que aparecem no composer das demandas (botão de templates na toolbar).
          Use pra padronizar respostas recorrentes do time.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {items.length === 0 && !editing && (
          <p className="text-xs text-muted-foreground italic">
            Nenhum template ainda. Clique em "Novo template" pra começar.
          </p>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-border bg-muted/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 mt-0.5">
                    {t.body}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(t)}
                    title="Editar"
                    className="h-7 w-7 p-0"
                  >
                    <Pencil size={13} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(t)}
                    title="Excluir"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing ? (
          <div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div>
              <label className="text-xs font-medium mb-1 block">Nome</label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex: Vamos providenciar"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Conteúdo da mensagem</label>
              <Textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                placeholder="Texto que será inserido no composer"
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={cancel} className="gap-1.5">
                <X size={13} /> Cancelar
              </Button>
              <Button size="sm" onClick={submit} className="gap-1.5">
                <Save size={13} /> Salvar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={startNew} className="gap-1.5">
            <Plus size={13} /> Novo template
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
