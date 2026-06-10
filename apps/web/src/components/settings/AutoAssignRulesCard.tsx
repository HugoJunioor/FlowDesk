/**
 * CRUD for auto-assignment rules — storage in localStorage `fd_auto_assign_rules`
 * via lib/autoAssignRules. Master-only card.
 *
 * Supports two rule kinds:
 *   - text_match: pattern matched against title or workflow (legacy form).
 *   - no_assignee: fallback assignee for demands that come in without one
 *     (e.g. Slack demands with no responsible yet).
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllUsers } from "@/lib/authStorage";
import {
  loadAutoAssignRules,
  upsertAutoAssignRule,
  deleteAutoAssignRule,
  newRule,
  type AutoAssignRule,
  type AutoAssignCondition,
} from "@/lib/autoAssignRules";

const PRIORITY_OPTIONS = [
  { value: "", label: "(manter prioridade da demanda)" },
  { value: "p1", label: "P1" },
  { value: "p2", label: "P2" },
  { value: "p3", label: "P3" },
];

export default function AutoAssignRulesCard() {
  const { toast } = useToast();
  const [items, setItems] = useState<AutoAssignRule[]>([]);
  const [editing, setEditing] = useState<AutoAssignRule | null>(null);
  const activeUsers = getAllUsers().filter((u) => u.status === "active");

  function reload() {
    setItems(loadAutoAssignRules());
  }

  useEffect(() => {
    reload();
  }, []);

  const startNew = (condition: AutoAssignCondition) => setEditing(newRule(condition));
  const startEdit = (r: AutoAssignRule) => setEditing({ ...r });
  const cancel = () => setEditing(null);

  const submit = () => {
    if (!editing) return;
    if (!editing.assignee) {
      toast({ title: "Responsável obrigatório", variant: "destructive" });
      return;
    }
    if (editing.condition === "text_match" && !editing.pattern?.trim()) {
      toast({ title: "Texto da regra obrigatório", variant: "destructive" });
      return;
    }
    if (editing.condition === "no_assignee") {
      // Apenas uma regra de fallback por vez — substitui a anterior se existir.
      const existing = items.find(
        (r) => r.condition === "no_assignee" && r.id !== editing.id,
      );
      if (existing) {
        deleteAutoAssignRule(existing.id);
      }
    }
    upsertAutoAssignRule(editing);
    reload();
    setEditing(null);
    toast({ title: "Regra salva" });
  };

  const remove = (id: string) => {
    deleteAutoAssignRule(id);
    reload();
    toast({ title: "Regra removida" });
  };

  const fallback = items.find((r) => r.condition === "no_assignee");
  const textRules = items.filter((r) => r.condition === "text_match");

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserCog size={18} className="text-primary" />
          <CardTitle className="text-base font-semibold">Regras de atribuição automática</CardTitle>
        </div>
        <CardDescription>
          Define responsáveis padrão para demandas — por texto do título/workflow ou como fallback quando vierem sem responsável (ex: chamados do Slack).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fallback (no_assignee) — destacado, único */}
        <div className="rounded-md border border-dashed border-border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Quando vier sem responsável</p>
              <p className="text-[11px] text-muted-foreground">
                Aplica este responsável a qualquer demanda que ainda esteja sem assignee.
              </p>
            </div>
            {fallback ? (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {fallback.assignee}
                  {fallback.priority ? ` · ${fallback.priority.toUpperCase()}` : ""}
                </Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(fallback)}>
                  <Pencil size={12} />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(fallback.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => startNew("no_assignee")}>
                <Plus size={13} className="mr-1" /> Definir
              </Button>
            )}
          </div>
        </div>

        {/* Lista das regras por texto */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Regras por texto</p>
            <Button size="sm" variant="outline" onClick={() => startNew("text_match")}>
              <Plus size={13} className="mr-1" /> Nova
            </Button>
          </div>
          {textRules.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Sem regras por texto.</p>
          )}
          {textRules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
              <div className="text-xs">
                <span className="text-muted-foreground">
                  Se {r.field === "workflow" ? "workflow" : "título"} {r.match === "equals" ? "for igual a" : "contém"}{" "}
                </span>
                <code className="px-1 py-0.5 bg-muted rounded text-foreground">{r.pattern}</code>
                <span className="text-muted-foreground"> → </span>
                <span className="font-medium text-foreground">{r.assignee}</span>
                {r.priority ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {r.priority.toUpperCase()}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                  <Pencil size={12} />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(r.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Editor inline */}
        {editing && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {editing.condition === "no_assignee" ? "Responsável padrão (sem assignee)" : "Regra por texto"}
              </p>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}>
                <X size={13} />
              </Button>
            </div>

            {editing.condition === "text_match" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Campo</label>
                  <Select
                    value={editing.field ?? "title"}
                    onValueChange={(v) => setEditing({ ...editing, field: v as "title" | "workflow" })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title">Título</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Operação</label>
                  <Select
                    value={editing.match ?? "includes"}
                    onValueChange={(v) => setEditing({ ...editing, match: v as "includes" | "equals" })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="includes">Contém</SelectItem>
                      <SelectItem value="equals">Igual a</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-muted-foreground">Texto</label>
                  <Input
                    value={editing.pattern ?? ""}
                    onChange={(e) => setEditing({ ...editing, pattern: e.target.value })}
                    placeholder="ex: conciliação manual"
                    className="h-9"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Responsável</label>
                <Select
                  value={editing.assignee}
                  onValueChange={(v) => setEditing({ ...editing, assignee: v })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Prioridade</label>
                <Select
                  value={editing.priority || "none"}
                  onValueChange={(v) => setEditing({ ...editing, priority: v === "none" ? undefined : v })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value || "none"} value={p.value || "none"}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={cancel}>Cancelar</Button>
              <Button size="sm" onClick={submit}>
                <Save size={13} className="mr-1" /> Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
