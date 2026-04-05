import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = login(username, password);
    if (!result.success) {
      toast({
        title: "Erro ao entrar",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">OpsSystem</h1>
          <p className="text-sm text-muted-foreground">Sistema de Operação Interna</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {showForgot ? "Recuperar Senha" : "Entrar"}
            </CardTitle>
            <CardDescription>
              {showForgot
                ? "Entre em contato com o administrador para redefinir sua senha."
                : "Informe suas credenciais para acessar o sistema."}
            </CardDescription>
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
                  <label className="text-sm font-medium text-foreground">Usuário</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Digite seu usuário"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10"
                      autoFocus
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

                <Button type="submit" className="w-full">
                  Entrar
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
  );
};

export default Login;
