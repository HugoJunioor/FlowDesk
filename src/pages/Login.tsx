import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, User, Eye, EyeOff, Workflow, Mail, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { branding } from "@/config/brandingLoader";
import { requestPasswordReset, isJustEmail, getPasswordStrength } from "@/lib/authStorage";
import PasswordStrength from "@/components/auth/PasswordStrength";

type View = "login" | "forgot" | "forgot_sent" | "change_password";

const Login = () => {
  const [view, setView] = useState<View>("login");
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Change password (first access)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { login, mustChangePassword, changePassword } = useAuth();
  const { toast } = useToast();

  // After login, if mustChangePassword is true, switch to change_password view
  const currentView = mustChangePassword ? "change_password" : view;

  // ── Login ────────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await login(loginInput, password);
    setIsLoading(false);
    if (!result.success) {
      toast({ title: "Erro ao entrar", description: result.error, variant: "destructive" });
    }
  };

  // ── Forgot password ───────────────────────────────────────────────────────────

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({ title: "Informe seu e-mail", variant: "destructive" });
      return;
    }
    if (!isJustEmail(forgotEmail)) {
      toast({ title: "E-mail inválido", description: "Use um e-mail corporativo válido.", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    const found = requestPasswordReset(forgotEmail);
    setForgotLoading(false);
    if (found) {
      setView("forgot_sent");
    } else {
      toast({ title: "E-mail não encontrado", description: "Verifique o endereço e tente novamente.", variant: "destructive" });
    }
  };

  // ── Change password (first access) ───────────────────────────────────────────

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast({ title: "Preencha os campos", variant: "destructive" });
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
    setChangingPassword(true);
    await changePassword(newPassword);
    setChangingPassword(false);
    toast({ title: "Senha criada com sucesso!", description: "Bem-vindo ao FlowDesk." });
  };

  // ── Shared brand panel ───────────────────────────────────────────────────────

  const BrandPanel = () => (
    <div className="hidden lg:flex lg:w-3/5 relative items-center justify-center p-12">
      <div className="relative z-10 text-white flex flex-col items-center text-center space-y-12">
        {branding.logo ? (
          <img src={branding.logo} alt={branding.name} className="h-48 w-auto" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Workflow className="w-10 h-10" />
          </div>
        )}
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold tracking-tight">{branding.name}</span>
          <span className="text-sm font-light tracking-wide text-white/70 mt-1">{branding.subtitle}</span>
        </div>
      </div>
    </div>
  );

  const MobileLogo = () => (
    <div className="text-center space-y-2 lg:hidden">
      {branding.logo ? (
        <img src={branding.logo} alt={branding.name} className="h-24 w-auto mx-auto mb-2" />
      ) : (
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 mb-2">
          <Workflow className="w-7 h-7 text-white" />
        </div>
      )}
      <h1 className="text-lg font-semibold text-white tracking-tight">{branding.name}</h1>
      <p className="text-sm text-white/70">{branding.subtitle}</p>
    </div>
  );

  const formPanel = (
    <div className="flex-1 lg:flex-none lg:w-[38%] flex flex-col justify-center items-center p-6 pb-20 lg:p-12 relative z-10 lg:bg-background lg:rounded-l-3xl lg:shadow-2xl lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:pb-12">
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        <MobileLogo />

        {/* ── LOGIN FORM ────────────────────────────────────────────────── */}
        {currentView === "login" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Entrar</CardTitle>
              <CardDescription className="text-xs">Use seu login e senha gerados pelo administrador</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Login</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="seu.login"
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      className="pl-10"
                      autoFocus
                      disabled={isLoading}
                      maxLength={50}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      maxLength={100}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Entrando...
                    </span>
                  ) : "Entrar"}
                </Button>

                <button
                  type="button"
                  onClick={() => setView("forgot")}
                  className="w-full text-sm text-primary hover:underline transition-colors"
                >
                  Esqueci minha senha
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── FORGOT PASSWORD ───────────────────────────────────────────── */}
        {currentView === "forgot" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound size={18} /> Recuperar Senha
              </CardTitle>
              <CardDescription className="text-xs">
                Informe seu e-mail para solicitar uma nova senha ao administrador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="seu@empresa.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="pl-10"
                      autoFocus
                      disabled={forgotLoading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? "Enviando..." : "Solicitar nova senha"}
                </Button>

                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={14} /> Voltar ao login
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── FORGOT SENT ──────────────────────────────────────────────── */}
        {currentView === "forgot_sent" && (
          <Card className="border-border/50 shadow-lg">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <CheckCircle2 size={40} className="text-success mx-auto" />
              <div>
                <p className="font-semibold text-foreground">Solicitação enviada!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O administrador foi notificado. Aguarde a nova senha temporária e acesse com ela — será necessário criar uma nova senha no primeiro acesso.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setView("login"); setForgotEmail(""); }}>
                Voltar ao login
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── CHANGE PASSWORD (first access / one-time) ─────────────────── */}
        {currentView === "change_password" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock size={18} /> Criar nova senha
              </CardTitle>
              <CardDescription className="text-xs">
                Este é seu primeiro acesso. Crie uma senha forte para continuar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showNew ? "text" : "password"}
                      placeholder="Crie uma senha forte"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={changingPassword}
                      maxLength={100}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={changingPassword}
                      maxLength={100}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não coincidem</p>
                  )}
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Requisitos da senha forte:</p>
                  {[
                    { label: "Pelo menos 6 caracteres", ok: newPassword.length >= 6 },
                    { label: "Letras maiúsculas (A-Z)", ok: /[A-Z]/.test(newPassword) },
                    { label: "Letras minúsculas (a-z)", ok: /[a-z]/.test(newPassword) },
                    { label: "Números (0-9)", ok: /[0-9]/.test(newPassword) },
                    { label: "Símbolos (!@#$%...)", ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword) },
                  ].map((req) => (
                    <div key={req.label} className={`flex items-center gap-1.5 ${req.ok ? "text-success" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${req.ok ? "bg-success" : "bg-muted-foreground"}`} />
                      {req.label}
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={changingPassword || !getPasswordStrength(newPassword).isStrong || newPassword !== confirmPassword}
                >
                  {changingPassword ? "Salvando..." : "Salvar e entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-white/50 lg:text-muted-foreground mt-6 text-center">
          FlowDesk &middot; 2026
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex login-page bg-gradient-to-br from-primary via-primary/90 to-primary/70 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[30%] w-[500px] h-[500px] rounded-full bg-white/5" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-white/5" />
      <div className="absolute top-[40%] left-[15%] w-[200px] h-[200px] rounded-full bg-white/5" />
      <BrandPanel />
      {formPanel}
    </div>
  );
};

export default Login;
