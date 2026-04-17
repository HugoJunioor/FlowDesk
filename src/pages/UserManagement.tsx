import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
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

const ROLE_LABELS: Record<UserRole, string> = {
  master: "Master",
  user: "Usuário",
};

const UserManagement = () => {
  const { currentUser } = useAuth();
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
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (!createEmail.trim()) {
      toast({ title: "E-mail é obrigatório", variant: "destructive" });
      return;
    }
    if (!isJustEmail(createEmail)) {
      toast({
        title: "E-mail inválido",
        description: "Apenas e-mails corporativos válidos são permitidos.",
        variant: "destructive",
      });
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === createEmail.trim().toLowerCase())) {
      toast({ title: "E-mail já cadastrado", variant: "destructive" });
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

  const handleCopyTempPass = () => {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.tempPassword);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
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
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    updateUser(editTarget.id, { name: editName.trim(), role: editRole, groups: editGroups });
    setSaving(false);
    setEditTarget(null);
    reload();
    toast({ title: "Usuário atualizado" });
  };

  // ── Block/Unblock ─────────────────────────────────────────────────────────────

  const handleToggleBlock = (user: FlowDeskUser) => {
    if (user.role === "master") return;
    const newStatus = user.status === "active" ? "blocked" : "active";
    updateUser(user.id, { status: newStatus });
    reload();
    toast({
      title: newStatus === "blocked" ? "Usuário bloqueado" : "Usuário ativado",
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser(deleteTarget.id);
    setDeleteTarget(null);
    reload();
    toast({ title: "Usuário excluído" });
  };

  // ── Reset password ────────────────────────────────────────────────────────────

  const handleGenerateReset = async (user: FlowDeskUser) => {
    const password = await generateResetPassword(user.id);
    setResetResult({ user, password });
    setCopiedReset(false);
    setShowResetPass(false);
    reload();
  };

  const handleCopyResetPass = () => {
    if (!resetResult) return;
    navigator.clipboard.writeText(resetResult.password);
    setCopiedReset(true);
    setTimeout(() => setCopiedReset(false), 2000);
  };

  // ── Groups ────────────────────────────────────────────────────────────────────

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    if (groups.includes(newGroupName.trim())) {
      toast({ title: "Grupo já existe", variant: "destructive" });
      return;
    }
    const updated = [...groups, newGroupName.trim()];
    saveGroups(updated);
    setGroups(updated);
    setNewGroupName("");
    setShowNewGroup(false);
    toast({ title: "Grupo criado" });
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
              <Users size={20} className="text-primary" /> Gerenciamento de Usuários
            </h1>
            <p className="text-sm text-muted-foreground">Crie, edite, bloqueie e exclua usuários da plataforma</p>
          </div>
          <Button onClick={() => { setShowCreate(true); resetCreateForm(); }} className="gap-2">
            <Plus size={16} /> Novo Usuário
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Ativos", value: totalActive, color: "text-success" },
            { label: "Bloqueados", value: totalBlocked, color: "text-destructive" },
            { label: "Aguardando 1º acesso", value: pendingFirstAccess, color: "text-warning" },
            { label: "Reset solicitado", value: pendingReset, color: "text-info" },
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
                placeholder="Buscar por nome, login ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 max-w-xs text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => setShowNewGroup(true)} className="gap-1.5 text-xs">
                <Plus size={13} /> Novo Grupo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 px-4 py-2 bg-muted/50 border-b border-border">
                {["Usuário", "E-mail / Login", "Perfil", "Status", "Ações"].map((h) => (
                  <span key={h} className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {h}
                  </span>
                ))}
              </div>

              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado
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
                            Aguardando 1º acesso
                          </Badge>
                        )}
                        {u.passwordResetRequested && (
                          <Badge variant="secondary" className="text-[10px] bg-info/10 text-info border-0">
                            Reset solicitado
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
                      <p className="text-xs text-muted-foreground mt-0.5">Login: <span className="font-mono">{u.login}</span></p>
                    </div>

                    {/* Role */}
                    <div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${u.role === "master" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </div>

                    {/* Status */}
                    <div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${u.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                      >
                        {u.status === "active" ? "Ativo" : "Bloqueado"}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Editar"
                        onClick={() => openEdit(u)}
                      >
                        <UserCog size={14} />
                      </Button>

                      {/* Generate/reset password */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-7 p-0 ${u.passwordResetRequested ? "text-info" : ""}`}
                        title={u.passwordResetRequested ? "Reset solicitado — gerar nova senha" : "Gerar nova senha"}
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
                          title={u.status === "active" ? "Bloquear" : "Ativar"}
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
                          title="Excluir"
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
              <Plus size={18} /> Novo Usuário
            </DialogTitle>
            <DialogDescription>Preencha nome e e-mail. O login e a senha temporária serão gerados automaticamente.</DialogDescription>
          </DialogHeader>

          {!createdResult ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome completo *</label>
                <Input
                  placeholder="Ex: João Silva"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">E-mail *</label>
                <Input
                  type="email"
                  placeholder="nome@empresa.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
                {createEmail && !isJustEmail(createEmail) && (
                  <p className="text-xs text-destructive">E-mail corporativo inválido</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Perfil de acesso</label>
                <Select value={createRole} onValueChange={(v) => setCreateRole(v as UserRole)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
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
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Criando..." : "Criar usuário"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* ── SHOW CREDENTIALS ─────────────────────────────────────── */
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-success/10 border border-success/30 p-4 space-y-3">
                <p className="text-sm font-semibold text-success flex items-center gap-2">
                  <Check size={16} /> Usuário criado com sucesso!
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Login gerado:</span>
                    <p className="font-mono font-semibold text-foreground">{createdResult.login}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Senha temporária (uso único):</span>
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
                        title="Copiar senha"
                      >
                        {copiedPass ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-warning">
                  <AlertTriangle size={12} className="inline mr-1" />
                  Guarde esta senha agora. No primeiro acesso, o usuário deverá criar uma nova senha forte.
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => { setShowCreate(false); resetCreateForm(); }}>
                  Fechar
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
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">E-mail</label>
              <Input value={editTarget?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Perfil de acesso</label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as UserRole)}
                disabled={editTarget?.id === currentUser?.id}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
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
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={18} /> Excluir Usuário
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RESET PASSWORD RESULT ─────────────────────────────────────────────── */}
      <Dialog open={!!resetResult} onOpenChange={(o) => !o && setResetResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} /> Nova Senha Temporária
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Uma nova senha temporária foi gerada para <strong>{resetResult?.user.name}</strong>.
              Ela só pode ser usada uma vez e deverá ser trocada no primeiro acesso.
            </p>
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Senha temporária:</p>
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
              Compartilhe esta senha com o usuário por um canal seguro.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── NEW GROUP MODAL ──────────────────────────────────────────────────── */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Grupo</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <Input
              placeholder="Nome do grupo..."
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
