import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, User, Eye, EyeOff, Workflow } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = login(username, password);
    setIsLoading(false);
    if (!result.success) {
      toast({
        title: "Erro ao entrar",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 items-center justify-center p-12 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-white/5" />
        <div className="absolute top-[40%] left-[20%] w-[200px] h-[200px] rounded-full bg-white/5" />

        <div className="relative z-10 text-white max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Workflow className="w-7 h-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">FlowDesk</span>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-bold leading-tight">
              Gerencie suas operacoes com simplicidade
            </h2>
            <p className="text-white/75 text-lg leading-relaxed">
              Tarefas, cadastros e relatorios em um unico lugar. Controle total da sua equipe.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">1.2k+</p>
              <p className="text-xs text-white/65 mt-1">Cadastros</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">94%</p>
              <p className="text-xs text-white/65 mt-1">Conclusao</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">24</p>
              <p className="text-xs text-white/65 mt-1">Ativas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Mobile logo */}
          <div className="text-center space-y-2 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
              <Workflow className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">FlowDesk</h1>
            <p className="text-sm text-muted-foreground">Sistema de Gestao Interna</p>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {showForgot ? "Recuperar Senha" : "Entrar"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showForgot ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                    Para redefinir sua senha, entre em contato com o administrador do sistema.
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowForgot(false)}
                  >
                    Voltar ao login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Usuario</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite seu usuario"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10"
                        autoFocus
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                    ) : (
                      "Entrar"
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="w-full text-sm text-primary hover:underline transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
