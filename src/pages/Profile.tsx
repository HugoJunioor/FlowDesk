import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserCircle, Lock, Eye, EyeOff, Save, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { updateUser, validateCPF, hashPassword, getUserById, changeUserPassword, getPasswordStrength } from "@/lib/authStorage";
import PasswordStrength from "@/components/auth/PasswordStrength";

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

const Profile = () => {
  const { currentUser, refreshUser } = useAuth();
  const { toast } = useToast();

  // Personal data
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setCpf(currentUser.cpf ? formatCPF(currentUser.cpf) : "");
      setPhone(currentUser.phone ? formatPhone(currentUser.phone) : "");
    }
  }, [currentUser]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    const rawCpf = cpf.replace(/\D/g, "");
    if (rawCpf && !validateCPF(rawCpf)) {
      toast({ title: "CPF inválido", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    updateUser(currentUser!.id, {
      name: name.trim(),
      cpf: rawCpf || undefined,
      phone: phone.replace(/\D/g, "") || undefined,
    });
    refreshUser();
    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
    toast({ title: "Perfil atualizado" });
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    const strength = getPasswordStrength(newPassword);
    if (!strength.isStrong) {
      toast({
        title: "Senha muito fraca",
        description: "Use letras maiúsculas, minúsculas, números e símbolos.",
        variant: "destructive",
      });
      return;
    }
    setSavingPassword(true);

    // Verify current password
    const currentHash = await hashPassword(currentPassword);
    const fresh = getUserById(currentUser!.id);
    if (!fresh || fresh.passwordHash !== currentHash) {
      setSavingPassword(false);
      toast({ title: "Senha atual incorreta", variant: "destructive" });
      return;
    }

    await changeUserPassword(currentUser!.id, newPassword);
    setSavingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Senha alterada com sucesso!" });
  };

  if (!currentUser) return null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserCircle size={22} className="text-primary" /> Meu Perfil
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie seus dados pessoais e senha</p>
        </div>

        {/* User info banner */}
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{currentUser.name}</p>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Login: <span className="font-mono">{currentUser.login}</span> •{" "}
                <span className={currentUser.role === "master" ? "text-primary font-medium" : ""}>
                  {currentUser.role === "master" ? "Master" : "Usuário"}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personal data */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle size={16} /> Dados Pessoais
            </CardTitle>
            <CardDescription className="text-xs">
              Preencha seus dados. CPF e telefone são opcionais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome completo *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">CPF</label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {cpf && cpf.replace(/\D/g, "").length === 11 && !validateCPF(cpf.replace(/\D/g, "")) && (
                  <p className="text-xs text-destructive">CPF inválido</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">E-mail</label>
              <Input value={currentUser.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
            </div>

            <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
              {profileSaved ? (
                <>
                  <Check size={16} /> Salvo!
                </>
              ) : savingProfile ? (
                "Salvando..."
              ) : (
                <>
                  <Save size={16} /> Salvar dados
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Change password */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock size={16} /> Alterar Senha
            </CardTitle>
            <CardDescription className="text-xs">
              Use uma senha forte com letras maiúsculas, minúsculas, números e símbolos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Senha atual</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="pl-10 pr-10"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Crie uma senha forte"
                  className="pl-10 pr-10"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirmar nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pl-10 pr-10"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              variant="outline"
              className="gap-2"
            >
              {savingPassword ? "Salvando..." : <><Lock size={16} /> Alterar senha</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Profile;
