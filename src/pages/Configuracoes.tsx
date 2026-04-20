import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Sun, Bell, Shield, Palette, Globe, Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { COLOR_THEMES } from "@/config/themes";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types/auth";

const Configuracoes = () => {
  const { mode, colorTheme, toggleMode, setColorTheme } = useTheme();
  const { username } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  return (
    <AppLayout>
      <div className="space-y-5 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("settings.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("settings.subtitle")}</p>
        </div>

        {/* Perfil */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("settings.profile")}</CardTitle>
            <CardDescription>{t("settings.profile.info")}</CardDescription>
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

        {/* Aparência — compacto */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-primary" />
              <CardTitle className="text-base font-semibold">{t("settings.appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Modo claro / escuro — linha compacta */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.theme.mode")}</p>
                <p className="text-xs text-muted-foreground">
                  {mode === "light" ? t("settings.theme.light") : t("settings.theme.dark")}
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                <button
                  onClick={() => mode !== "light" && toggleMode()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === "light"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun size={13} />
                  {t("settings.theme.light")}
                </button>
                <button
                  onClick={() => mode !== "dark" && toggleMode()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === "dark"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon size={13} />
                  {t("settings.theme.dark")}
                </button>
              </div>
            </div>

            {/* Cor do tema — swatches compactos em linha */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">{t("settings.theme.color")}</p>
                <span className="text-xs text-muted-foreground capitalize">
                  {COLOR_THEMES.find((c) => c.id === colorTheme)?.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_THEMES.map((c) => {
                  const isActive = colorTheme === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setColorTheme(c.id)}
                      className={`relative w-8 h-8 rounded-full transition-all duration-150 shadow-sm ${
                        isActive
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c.previewColor }}
                      title={c.label}
                    >
                      {isActive && (
                        <Check
                          size={14}
                          className="absolute inset-0 m-auto text-white drop-shadow"
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Idioma */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-primary" />
              <CardTitle className="text-base font-semibold">{t("settings.language")}</CardTitle>
            </div>
            <CardDescription>{t("settings.language.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">
                  {AVAILABLE_LANGUAGES.find((l) => l.id === language)?.flag}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {AVAILABLE_LANGUAGES.find((l) => l.id === language)?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {AVAILABLE_LANGUAGES.find((l) => l.id === language)?.nativeName}
                  </p>
                </div>
              </div>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="inline-flex items-center gap-2">
                        <span>{l.flag}</span>
                        <span>{l.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Em breve — apenas Notificacoes e Seguranca (idioma saiu daqui) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Bell, title: t("settings.notifications"), desc: t("settings.notifications.description") },
            { icon: Shield, title: t("settings.security"), desc: t("settings.security.description") },
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
                <Badge variant="secondary" className="mt-3 text-[10px]">{t("settings.soon")}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
