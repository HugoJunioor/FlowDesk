import { useEffect, useState } from "react";
import type { FlowDeskUser } from "@/types/auth";
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
import { Moon, Sun, Bell, Shield, Palette, Globe, Check, Lock, Users } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { COLOR_THEMES } from "@/config/themes";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n";
import { getAllUsers } from "@/lib/authStorage";
import { hasPermission } from "@/lib/permissionsStorage";
import type { Language } from "@/types/auth";
import NotificationPreferencesCard from "@/components/notifications/NotificationPreferencesCard";
import { TelegramConnect } from "@/modules/configuracoes/components/TelegramConnect";
import ReplyTemplatesCard from "@/components/settings/ReplyTemplatesCard";
import AutoAssignRulesCard from "@/components/settings/AutoAssignRulesCard";

function loadApprovers(): string[] {
  try {
    const v = localStorage.getItem("flowdesk:approvers");
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

function saveApprovers(list: string[]) {
  localStorage.setItem("flowdesk:approvers", JSON.stringify(list));
}

const Configuracoes = () => {
  const { mode, colorTheme, toggleMode, setColorTheme } = useTheme();
  const { username, currentUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const isMaster = currentUser?.role === "master";
  // Permissão pra cards "admin": master + qualquer user em grupo com edit em configuracoes.
  const canAdminConfig = hasPermission(currentUser, "configuracoes", "edit");
  // getAllUsers virou async no PR #178 — carrega via useEffect e mantem em state.
  const [allUsers, setAllUsers] = useState<FlowDeskUser[]>([]);
  useEffect(() => {
    getAllUsers().then((list) => setAllUsers(list.filter((u) => u.status === "active"))).catch(() => { /* keep empty */ });
  }, []);
  const [approvers, setApprovers] = useState<string[]>(loadApprovers);

  const toggleApprover = (email: string) => {
    setApprovers((prev) => {
      const next = prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email];
      saveApprovers(next);
      return next;
    });
  };

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

        {/* Notificacoes — card funcional com toggles */}
        <NotificationPreferencesCard />

        {/* Telegram — conexão e preferência de canal */}
        <TelegramConnect />

        {/* Templates de resposta — CRUD usado pelo composer */}
        <ReplyTemplatesCard />

        {/* Regras de atribuição automática — master + grupos com edit em configuracoes */}
        {canAdminConfig && <AutoAssignRulesCard />}

        {/* Master-only: Configuração de Operações SQL */}
        {isMaster ? (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                <CardTitle className="text-base font-semibold">{t("settings.sql_ops.title")}</CardTitle>
              </div>
              <CardDescription>
                {t("settings.sql_ops.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("settings.sql_ops.flow_pre")}
                <strong className="text-foreground mx-1">{t("settings.sql_ops.pending_status")}</strong>
                {t("settings.sql_ops.flow_post")}
              </p>
              <div className="rounded-md border p-3 bg-warning/5 border-warning/20 text-xs text-warning flex items-start gap-2">
                <Lock size={13} className="mt-0.5 shrink-0" />
                <span>{t("settings.sql_ops.warning")}</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border shadow-sm opacity-60 pointer-events-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Lock size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t("settings.sql_ops.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.sql_ops.warning")}</p>
                </div>
              </div>
              <Badge variant="secondary" className="mt-3 text-[10px]">{t("settings.restricted_access")}</Badge>
            </CardContent>
          </Card>
        )}

        {/* Master-only: Aprovadores de Operações */}
        {isMaster && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <CardTitle className="text-base font-semibold">{t("settings.approvers.title")}</CardTitle>
              </div>
              <CardDescription>
                {t("settings.approvers.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {allUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("settings.approvers.empty")}</p>
              )}
              {allUsers.map((u) => {
                const isApprover = approvers.includes(u.email) || (approvers.length === 0 && u.role === "master");
                return (
                  <div key={u.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.name}</p>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                      {u.role === "master" && <Badge variant="secondary" className="text-[10px]">master</Badge>}
                    </div>
                    <button
                      onClick={() => toggleApprover(u.email)}
                      className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors ${
                        isApprover
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                      title={isApprover ? t("settings.approvers.remove_tooltip") : t("settings.approvers.add_tooltip")}
                    >
                      <Check size={14} strokeWidth={isApprover ? 3 : 1.5} />
                    </button>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground pt-1">
                {t("settings.approvers.local_note").split("{key}")[0]}
                <code>flowdesk:approvers</code>
                {t("settings.approvers.local_note").split("{key}")[1] ?? ""}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Em breve — apenas Seguranca agora */}
        <Card className="border border-border shadow-sm opacity-60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Shield size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.security")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.security.description")}</p>
              </div>
            </div>
            <Badge variant="secondary" className="mt-3 text-[10px]">{t("settings.soon")}</Badge>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
