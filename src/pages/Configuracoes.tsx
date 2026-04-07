import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Bell, Shield, Palette, Globe } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

const Configuracoes = () => {
  const { theme, toggleTheme } = useTheme();
  const { username } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuracoes</h1>
          <p className="text-muted-foreground text-sm mt-1">Ajustes e preferencias do sistema</p>
        </div>

        {/* Perfil */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Perfil</CardTitle>
            <CardDescription>Informacoes da sua conta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                {username?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground">{username}</p>
                <Badge variant="secondary" className="text-[10px] mt-1">Administrador</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aparencia */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-primary" />
              <CardTitle className="text-base font-semibold">Aparencia</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Tema</p>
                <p className="text-xs text-muted-foreground mt-0.5">Escolha entre modo claro e escuro</p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? "Claro" : "Escuro"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Em breve */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Bell, title: "Notificacoes", desc: "Configurar alertas e emails" },
            { icon: Shield, title: "Seguranca", desc: "Senha e autenticacao" },
            { icon: Globe, title: "Idioma", desc: "Preferencia de idioma" },
          ].map((item) => (
            <Card key={item.title} className="border border-border shadow-sm opacity-60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <item.icon size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="mt-3 text-[10px]">Em breve</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
