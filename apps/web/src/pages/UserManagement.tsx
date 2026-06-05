import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { copyToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Plus,
  Trash2,
  ShieldOff,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  UserCog,
  Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  generateResetPassword,
  getGroups,
  saveGroups,
  isJustEmail,
} from "@/lib/authStorage";
import type { FlowDeskUser, UserRole } from "@/types/auth";

// Chaves i18n por role — labels resolvidas em render via t().
const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  master: "users.role.master",
  user: "users.role.user",
};

const UserManagement = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [users, setUsers] = useState<FlowDeskUser[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("user");
  const [createGroups, setCreateGroups] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    login: string;
    tempPassword: string;
  } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showTempPass, setShowTempPass] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<FlowDeskUser | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<FlowDeskUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("user");
  const [editGroups, setEditGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset password result
  const [resetResult, setResetResult] = useState<{
    user: FlowDeskUser;
    password: string;
  } | null>(null);
  const [copiedReset, setCopiedReset] = useState(false);
  const [showResetPass, setShowResetPass] = useState(false);

  // New group modal
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const reload = useCallback(() => {
    setUsers(getAllUsers());
    setGroups(getGroups());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.login.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── Create ────────────────────────────────────────────────────────────────────

  const resetCreateForm = () => {
    setCreateName("");
    setCreateEmail("");
    setCreateRole("user");
    setCreateGroups([]);
    setCreatedResult(null);
    setCopiedPass(false);
    setShowTempPass(false);
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast({ title: t("users.toast.name_required"), variant: "destructive" });
      return;
    }
    if (!createEmail.trim()) {
      toast({ title: t("users.toast.email_required"), variant: "destructive" });
      return;
    }
    if (!isJustEmail(createEmail)) {
      toast({
        title: t("users.toast.invalid_email"),
        description: t("users.toast.invalid_email_desc"),
        variant: "destructive",
      });
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === createEmail.trim().toLowerCase())) {
      toast({ title: t("users.toast.email_taken"), variant: "destructive" });
      return;
    }

    setCreating(true);
    const { user, tempPassword } = await createUser({
      name: createName,
      email: createEmail,
      role: createRole,
      groups: createGroups,
      createdBy: currentUser?.id || "master",
    });
    setCreating(false);
    setCreatedResult({ login: user.login, tempPassword });
    reload();
  };

  const handleCopyTempPass = async () => {
    if (!createdResult) return;
    const ok = await copyToClipboard(createdResult.tempPassword);
    if (ok) {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } else {
      toast({ title: t("users.toast.copy_failed"), description: t("users.toast.copy_failed_desc"), variant: "destructive" });
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────────

  const openEdit = (user: FlowDeskUser) => {
    setEditTarget(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditGroups(user.groups);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      toast({ title: t("users.toast.name_required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    updateUser(editTarget.id, { name: editName.trim(), role: editRole, groups: editGroups });
    setSaving(false);
    setEditTarget(null);
    reload();
    toast({ title: t("users.toast.user_updated") });
  };

  // ── Block/Unblock ─────────────────────────────────────────────────────────────

  const handleToggleBlock = (user: FlowDeskUser) => {
    if (user.role === "master") return;
    const newStatus = user.status === "active" ? "blocked" : "active";
    updateUser(user.id, { status: newStatus });
    reload();
    toast({
      title: newStatus === "blocked" ? t("users.toast.user_blocked") : t("users.toast.user_activated"),
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser(deleteTarget.id);
    setDeleteTarget(null);
    reload();
    toast({ title: t("users.toast.user_deleted") });
  };

  // ── Reset password ────────────────────────────────────────────────────────────

  const handleGenerateReset = async (user: FlowDeskUser) => {
    const password = await generateResetPassword(user.id);
    setResetResult({ user, password });
    setCopiedReset(false);
    setShowResetPass(false);
    reload();
  };

  const handleCopyResetPass = async () => {
    if (!resetResult) return;
    const ok = await copyToClipboard(resetResult.password);
    if (ok) {
      setCopiedReset(true);
      setTimeout(() => setCopiedReset(false), 2000);
    } else {
      toast({ title: t("users.toast.copy_failed"), description: t("users.toast.copy_failed_desc"), variant: "destructive" });
    }
  };

  // ── Groups ────────────────────────────────────────────────────────────────────

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    if (groups.includes(newGroupName.trim())) {
      toast({ title: t("users.toast.group_taken"), variant: "destructive" });
      return;
    }
    const updated = [...groups, newGroupName.trim()];
    saveGroups(updated);
    setGroups(updated);
    setNewGroupName("");
    setShowNewGroup(false);
    toast({ title: t("users.toast.group_created") });
  };

  const toggleGroupFilter = (g: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(g) ? current.filter((x) => x !== g) : [...current, g]);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const totalActive = users.filter((u) => u.status === "active").length;
  const totalBlocked = users.filter((u) => u.status === "blocked").length;
  const pendingReset = users.filter((u) => u.passwordResetRequested).length;
  const pendingFirstAccess = users.filter((u) => u.isFirstAccess && !u.passwordResetRequested).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users size={20} className="text-primary" /> {t("users.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("users.subtitle")}</p>
          </div>
          <Button onClick={() => { setShowCreate(true); resetCreateForm(); }} className="gap-2">
            <Plus size={16} /> {t("users.new_button")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("users.stat.active"), value: totalActive, color: "text-success" },
            { label: t("users.stat.blocked"), value: totalBlocked, color: "text-destructive" },
            { label: t("users.stat.pending_first_access"), value: pendingFirstAccess, color: "text-warning" },
            { label: t("users.stat.reset_requested"), value: pendingReset, color: "text-info" },
          ].map((s) => (
            <Card key={s.label} className="border border-border">
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder={t("users.search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 max-w-xs text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => setShowNewGroup(true)} className="gap-1.5 text-xs">
                <Plus size={13} /> {t("users.new_group_button")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 px-4 py-2 bg-muted/50 border-b border-border">
                {[t("users.col.user"), t("users.col.email_login"), t("users.col.role"), t("users.col.status"), t("users.col.actions")].map((h) => (
                  <span key={h} className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {h}
                  </span>
                ))}
              </div>

              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {t("users.empty")}
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 px-4 py-3 border-b border-border/50 last:border-0 items-center hover:bg-muted/30 transition-colors"
                  >
                    {/* Name + badges */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {u.isFirstAccess && (
                          <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-0">
                            {t("users.badge.pending_first_access")}
                          </Badge>
                        )}
                        {u.passwordResetRequested && (
                          <Badge variant="secondary" className="text-[10px] bg-info/10 text-info border-0">
                            {t("users.badge.reset_requested")}
                          </Badge>
                        )}
                        {u.groups.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {u.groups.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Email + login */}
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate flex items-center gap-1">
                        <Mail size={10} className="text-muted-foreground shrink-0" />
                        {u.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("users.login_label")} <span className="font-mono">{u.login}</span></p>
                    </div>

                    {/* Role */}
                    <div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${u.role === "master" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {t(ROLE_LABEL_KEYS[u.role])}
                      </Badge>
                    </div>

                    {/* Status */}
                    <div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${u.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                      >
                        {u.status === "active" ? t("users.status.active") : t("users.status.blocked")}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title={t("users.action.edit")}
                        onClick={() => openEdit(u)}
                      >
                        <UserCog size={14} />
                      </Button>

                      {/* Generate/reset password */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-7 p-0 ${u.passwordResetRequested ? "text-info" : ""}`}
                        title={u.passwordResetRequested ? t("users.action.reset_with_pending") : t("users.action.reset")}
                        onClick={() => handleGenerateReset(u)}
                      >
                        <KeyRound size={14} />
                      </Button>

                      {/* Block/unblock */}
                      {u.role !== "master" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 ${u.status === "blocked" ? "text-success" : "text-warning"}`}
                          title={u.status === "active" ? t("users.action.block") : t("users.action.activate")}
                          onClick={() => handleToggleBlock(u)}
                        >
                          {u.status === "active" ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                        </Button>
                      )}

                      {/* Delete */}
                      {u.role !== "master" && u.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title={t("users.action.delete")}
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CREATE USER MODAL ─────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); resetCreateForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} /> {t("users.create.title")}
            </DialogTitle>
            <DialogDescription>{t("users.create.description")}</DialogDescription>
          </DialogHeader>

          {!createdResult ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("users.create.name_label")}</label>
                <Input
                  placeholder={t("users.create.name_placeholder")}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("users.create.email_label")}</label>
                <Input
                  type="email"
                  placeholder={t("users.create.email_placeholder")}
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
                {createEmail && !isJustEmail(createEmail) && (
                  <p className="text-xs text-destructive">{t("users.create.invalid_email_inline")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("users.create.role_label")}</label>
                <Select value={createRole} onValueChange={(v) => setCreateRole(v as UserRole)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t("users.role.user")}</SelectItem>
                    <SelectItem value="master">{t("users.role.master")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {groups.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("users.create.groups_label")}</label>
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGroupFilter(g, createGroups, setCreateGroups)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          createGroups.includes(g)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCreate(false); resetCreateForm(); }}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? t("users.create.creating") : t("users.create.submit")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* ── SHOW CREDENTIALS ─────────────────────────────────────── */
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-success/10 border border-success/30 p-4 space-y-3">
                <p className="text-sm font-semibold text-success flex items-center gap-2">
                  <Check size={16} /> {t("users.create.success")}
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">{t("users.create.login_generated")}</span>
                    <p className="font-mono font-semibold text-foreground">{createdResult.login}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">{t("users.create.temp_password")}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono font-semibold text-foreground text-base tracking-wider">
                        {showTempPass ? createdResult.tempPassword : "••••••••••"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowTempPass(!showTempPass)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {showTempPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyTempPass}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title={t("users.create.copy_password_tooltip")}
                      >
                        {copiedPass ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-warning">
                  <AlertTriangle size={12} className="inline mr-1" />
                  {t("users.create.warning")}
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => { setShowCreate(false); resetCreateForm(); }}>
                  {t("users.create.close")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT USER MODAL ──────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.edit.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("users.edit.name_label")}</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("users.edit.email_label")}</label>
              <Input value={editTarget?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t("users.edit.email_disabled_hint")}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("users.create.role_label")}</label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as UserRole)}
                disabled={editTarget?.id === currentUser?.id}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("users.role.user")}</SelectItem>
                  <SelectItem value="master">{t("users.role.master")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {groups.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Grupos</label>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGroupFilter(g, editGroups, setEditGroups)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        editGroups.includes(g)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? t("users.edit.saving") : t("users.edit.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={18} /> {t("users.delete.title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t("users.delete.confirm").split("{name}")[0]}<strong>{deleteTarget?.name}</strong>{t("users.delete.confirm").split("{name}")[1] ?? ""}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("users.action.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RESET PASSWORD RESULT ─────────────────────────────────────────────── */}
      <Dialog open={!!resetResult} onOpenChange={(o) => !o && setResetResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} /> {t("users.reset.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("users.reset.description").split("{name}")[0]}<strong>{resetResult?.user.name}</strong>{t("users.reset.description").split("{name}")[1] ?? ""}
            </p>
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-xs text-muted-foreground">{t("users.reset.label")}</p>
              <div className="flex items-center gap-2">
                <p className="font-mono font-semibold text-lg text-foreground tracking-wider flex-1">
                  {showResetPass ? resetResult?.password : "••••••••••"}
                </p>
                <button
                  type="button"
                  onClick={() => setShowResetPass(!showResetPass)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showResetPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyResetPass}
                  className="text-muted-foreground hover:text-primary"
                >
                  {copiedReset ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <p className="text-xs text-warning flex items-start gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {t("users.reset.share_hint")}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>{t("users.create.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── NEW GROUP MODAL ──────────────────────────────────────────────────── */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("users.new_group.title")}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <Input
              placeholder={t("users.new_group.placeholder")}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
            />
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroup(false)}>Cancelar</Button>
            <Button onClick={handleAddGroup}>Criar Grupo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default UserManagement;
