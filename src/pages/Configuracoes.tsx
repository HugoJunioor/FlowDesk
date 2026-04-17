import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Bell, Shield, Palette, Globe, Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { COLOR_THEMES } from "@/config/themes";

const Configuracoes = () => {
  const { mode, colorTheme, toggleMode, setColorTheme } = useTheme();
  const { username } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Ajustes e preferências do sistema</p>
        </div>

        {/* Perfil */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Perfil</CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
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

        {/* Aparência */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-primary" />
              <CardTitle className="text-base font-semibold">Aparência</CardTitle>
            </div>
            <CardDescription>Personalize o visual do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Modo claro / escuro */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Modo de exibição</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => mode !== "light" && toggleMode()}
                  className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 ${
                    mode === "light"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-3 rounded-xl ${mode === "light" ? "bg-primary/10" : "bg-muted"}`}>
                    <Sun size={22} className={mode === "light" ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <span className={`text-sm font-medium ${mode === "light" ? "text-primary" : "text-muted-foreground"}`}>
                    Claro
                  </span>
                  {mode === "light" && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => mode !== "dark" && toggleMode()}
                  className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 ${
                    mode === "dark"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-3 rounded-xl ${mode === "dark" ? "bg-primary/10" : "bg-muted"}`}>
                    <Moon size={22} className={mode === "dark" ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <span className={`text-sm font-medium ${mode === "dark" ? "text-primary" : "text-muted-foreground"}`}>
                    Escuro
                  </span>
                  {mode === "dark" && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t border-border" />

            {/* Cor do tema */}
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Cor do tema</p>
              <p className="text-xs text-muted-foreground mb-4">
                Escolha a cor principal que será aplicada na sidebar e nos elementos de destaque
              </p>
              <div className="grid grid-cols-5 sm:grid-cols-5 gap-3">
                {COLOR_THEMES.map((t) => {
                  const isActive = colorTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setColorTheme(t.id)}
                      className={`group flex flex-col items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm scale-[1.02]"
                          : "border-transparent hover:border-border hover:bg-muted/40"
                      }`}
                      title={t.label}
                    >
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-full transition-all duration-200 shadow-sm ${
                            isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "group-hover:scale-110"
                          }`}
                          style={{ backgroundColor: t.previewColor }}
                        />
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check size={18} className="text-white drop-shadow-md" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-medium leading-tight text-center ${
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Em breve */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Bell, title: "Notificações", desc: "Configurar alertas e emails" },
            { icon: Shield, title: "Segurança", desc: "Senha e autenticação" },
            { icon: Globe, title: "Idioma", desc: "Preferência de idioma" },
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
