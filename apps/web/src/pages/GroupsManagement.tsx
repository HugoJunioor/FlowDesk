import { useState, useCallback, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Plus, Pencil, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  GroupPermissions,
  ModuleId,
  Permission,
  MODULES,
  PERMISSIONS,
} from "@/types/permissions";
import {
  loadGroupPermissions,
  createGroup,
  updateGroup,
  deleteGroup,
} from "@/lib/permissionsStorage";
import { getAllUsers } from "@/lib/authStorage";

const emptyGroup = (): GroupPermissions => ({
  name: "",
  description: "",
  modules: {},
});

const GroupsManagement = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupPermissions[]>([]);
  // getAllUsers virou async no PR #178 — hidrata em useEffect.
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getAllUsers>>>([]);
  useEffect(() => {
    getAllUsers().then(setUsers).catch(() => { /* keep empty */ });
  }, []);
  const [editing, setEditing] = useState<GroupPermissions | null>(null);
  const [editingOriginalName, setEditingOriginalName] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const reload = useCallback(() => {
    setGroups(loadGroupPermissions());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Bloqueia para nao-master
  if (currentUser?.role !== "master") {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <ShieldCheck size={40} className="text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Acesso restrito</p>
              <p className="text-sm text-muted-foreground">
                Apenas administradores master podem gerenciar grupos.
              </p>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Contagem de usuarios em cada grupo (users vem do state hidratado async).
  const userCountByGroup = (name: string) =>
    users.filter((u) => (u.groups || []).some((g) => g.toLowerCase() === name.toLowerCase())).length;

  const openCreate = () => {
    setEditing(emptyGroup());
    setEditingOriginalName(null);
    setIsCreating(true);
  };

  const openEdit = (g: GroupPermissions) => {
    setEditing({ ...g, modules: { ...g.modules } });
    setEditingOriginalName(g.name);
    setIsCreating(false);
  };

  const togglePermission = (moduleId: ModuleId, permission: Permission) => {
    if (!editing) return;
    const current = editing.modules[moduleId] || [];
    const has = current.includes(permission);
    const next = has ? current.filter((p) => p !== permission) : [...current, permission];
    const updatedModules = { ...editing.modules, [moduleId]: next };
    if (next.length === 0) delete updatedModules[moduleId];
    setEditing({ ...editing, modules: updatedModules });
  };

  const handleSave = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      toast({ title: t("groups.toast.name_required"), variant: "destructive" });
      return;
    }
    if (isCreating) {
      const ok = createGroup({ ...editing, name });
      if (!ok) {
        toast({ title: t("groups.toast.duplicate_name"), variant: "destructive" });
        return;
      }
      toast({ title: t("groups.toast.created"), description: t("groups.toast.created_desc", { name }) });
    } else {
      const ok = updateGroup(editingOriginalName!, { ...editing, name });
      if (!ok) {
        toast({ title: t("groups.toast.save_error"), variant: "destructive" });
        return;
      }
      toast({ title: t("groups.toast.updated"), description: t("groups.toast.updated_desc", { name }) });
    }
    setEditing(null);
    setEditingOriginalName(null);
    reload();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const ok = deleteGroup(deleteTarget);
    if (ok) {
      toast({ title: t("groups.toast.removed"), description: t("groups.toast.removed_desc", { name: deleteTarget }) });
    } else {
      toast({ title: t("groups.toast.remove_error"), variant: "destructive" });
    }
    setDeleteTarget(null);
    reload();
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary" size={22} />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{t("groups.title")}</h1>
              <p className="text-xs text-muted-foreground">
                {t("groups.description")}
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus size={14} />
            {t("groups.new")}
          </Button>
        </div>

        {/* Lista de grupos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.length === 0 ? (
            <Card className="md:col-span-2">
              <CardContent className="p-12 flex flex-col items-center text-center gap-3">
                <ShieldCheck size={40} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("groups.empty")}
                </p>
              </CardContent>
            </Card>
          ) : (
            groups.map((g) => {
              const modulesWithAccess = Object.entries(g.modules).filter(
                ([, perms]) => (perms || []).length > 0
              );
              return (
                <Card key={g.name} className="border border-border shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          {g.name}
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Users size={10} /> {userCountByGroup(g.name)}
                          </Badge>
                        </CardTitle>
                        {g.description && (
                          <p className="text-xs text-muted-foreground mt-1">{g.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(g)}
                          title={t("groups.edit_tooltip")}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(g.name)}
                          title={t("groups.remove_tooltip")}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {modulesWithAccess.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">{t("groups.no_permissions")}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {modulesWithAccess.map(([moduleId, perms]) => {
                          const mod = MODULES.find((m) => m.id === moduleId);
                          return (
                            <div key={moduleId} className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-foreground min-w-[110px]">
                                {mod?.label || moduleId}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(perms || []).map((p) => (
                                  <Badge
                                    key={p}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {PERMISSIONS.find((pp) => pp.id === p)?.label || p}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Dialog de criar/editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? t("groups.dialog.new_title") : t("groups.dialog.edit_title", { name: editingOriginalName })}</DialogTitle>
            <DialogDescription>
              {t("groups.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("groups.field.name")}</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder={t("groups.field.name_placeholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("groups.field.description")}</label>
                <Textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder={t("groups.field.description_placeholder")}
                  rows={2}
                />
              </div>

              {/* Matriz de permissoes */}
              <div>
                <label className="text-sm font-medium block mb-2">{t("groups.permissions_label")}</label>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    <span className="flex-1 min-w-[130px]">{t("groups.module_header")}</span>
                    {PERMISSIONS.map((p) => (
                      <span key={p.id} className="w-[70px] text-center">
                        {p.label}
                      </span>
                    ))}
                  </div>
                  {MODULES.map((mod) => {
                    const current = editing.modules[mod.id] || [];
                    return (
                      <div
                        key={mod.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border/30 last:border-b-0 hover:bg-muted/20"
                      >
                        <span className="flex-1 text-sm text-foreground min-w-[130px]">
                          {mod.label}
                        </span>
                        {PERMISSIONS.map((p) => (
                          <div key={p.id} className="w-[70px] flex justify-center">
                            <Checkbox
                              checked={current.includes(p.id)}
                              onCheckedChange={() => togglePermission(mod.id, p.id)}
                              title={p.description}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("groups.tip_prefix")} <strong>{t("groups.tip_visualize")}</strong>, {t("groups.tip_suffix")}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave}>
              {isCreating ? t("groups.create_button") : t("groups.save_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.delete_title", { name: deleteTarget ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("groups.delete_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("groups.delete_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default GroupsManagement;
