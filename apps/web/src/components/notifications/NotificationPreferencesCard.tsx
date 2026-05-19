/**
 * Card de preferencias de notificacao — fica em /configuracoes.
 *
 * User configura:
 * - Por evento (atribuida, respondida, concluida, etc): liga/desliga
 * - Por canal (inbox sempre ligado, push e email opt-in)
 * - Lembretes SLA: quantas horas antes do vencimento notificar (P1/P2/P3)
 *
 * Persistencia via apiClient.notifications (rota /notifications/preferences).
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Save, Mail, BellRing, Inbox, AlertCircle, CheckCircle2, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import {
  NotificationPreferences,
  DEFAULT_PREFERENCES,
  EVENT_LABELS,
  NotificationEvent,
} from "@/types/notification";
import {
  requestBrowserNotificationPermission,
  getPermission,
  isBrowserNotificationSupported,
  showBrowserNotification,
} from "@/lib/browserNotifications";

const EVENT_ORDER: NotificationEvent[] = [
  "demand_assigned",
  "demand_replied",
  "demand_started",
  "demand_completed",
  "demand_reopened",
  "demand_overdue",
  "demand_due_soon",
  "demand_created",
];

const NotificationPreferencesCard = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pushPerm, setPushPerm] = useState(getPermission());

  const email = currentUser?.email || "";

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    apiClient.notifications.getPreferences(email)
      .then((r) => {
        if (cancelled) return;
        // Merge defaults com o que tiver salvo
        const merged: NotificationPreferences = r.preferences
          ? { ...DEFAULT_PREFERENCES, ...r.preferences, userEmail: email }
          : { userEmail: email, ...DEFAULT_PREFERENCES };
        setPrefs(merged);
      })
      .catch(() => {
        if (!cancelled) {
          setPrefs({ userEmail: email, ...DEFAULT_PREFERENCES });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [email]);

  const updateEvent = (event: NotificationEvent, enabled: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, events: { ...prefs.events, [event]: enabled } });
    setDirty(true);
  };

  const updateDailyReminder = (enabled: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, dailyReminder: enabled });
    setDirty(true);
  };

  const updateChannel = async (channel: "inbox" | "browserPush" | "email", enabled: boolean) => {
    if (!prefs) return;
    // Pedir permissao do navegador ao ligar o toggle de push
    if (channel === "browserPush" && enabled) {
      if (!isBrowserNotificationSupported()) {
        toast({
          title: "Navegador não suporta",
          description: "Use Chrome, Edge ou Firefox no desktop pra ativar push.",
          variant: "destructive",
        });
        return;
      }
      const perm = await requestBrowserNotificationPermission();
      setPushPerm(perm);
      if (perm === "denied") {
        toast({
          title: "Permissão negada",
          description: "Habilite notificações nas configurações do navegador pra esse site.",
          variant: "destructive",
        });
        return;
      }
      if (perm !== "granted") {
        // user fechou o prompt sem decidir
        return;
      }
      // Notificacao de teste pra confirmar que ta funcionando
      showBrowserNotification({
        title: "FlowDesk · Notificações ativas",
        body: "Você vai receber novidades aqui daqui pra frente.",
        tag: `setup_push_${Date.now()}`,
      });
    }
    setPrefs({ ...prefs, channels: { ...prefs.channels, [channel]: enabled } });
    setDirty(true);
  };

  const updateSlaReminder = (key: "p1Hours" | "p2Hours" | "p3Hours", hours: number) => {
    if (!prefs) return;
    setPrefs({ ...prefs, slaReminders: { ...prefs.slaReminders, [key]: hours } });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      await apiClient.notifications.savePreferences(prefs);
      toast({ title: "Preferências salvas" });
      setDirty(false);
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 size={16} className="animate-spin inline mr-2" /> Carregando preferências...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell size={16} className="text-primary" />
          Notificações
        </CardTitle>
        <CardDescription>
          Configure quais eventos te notificam e por onde (inbox, push do navegador, e-mail).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* CANAIS GLOBAIS */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Canais</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Inbox size={14} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Inbox no FlowDesk</p>
                  <p className="text-[11px] text-muted-foreground">
                    Sino na sidebar — sempre ativo
                  </p>
                </div>
              </div>
              <Switch checked={prefs.channels.inbox} disabled />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <BellRing size={14} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Push do navegador</p>
                  <p className="text-[11px] text-muted-foreground">
                    Notificações no sistema operacional
                    {pushPerm === "granted" && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-success">
                        <CheckCircle2 size={10} /> permitido
                      </span>
                    )}
                    {pushPerm === "denied" && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-destructive">
                        <AlertCircle size={10} /> bloqueado no navegador
                      </span>
                    )}
                    {pushPerm === "default" && (
                      <span className="ml-1.5 text-warning">
                        pedirá permissão ao ativar
                      </span>
                    )}
                    {pushPerm === "unsupported" && (
                      <span className="ml-1.5 text-muted-foreground italic">
                        não suportado neste navegador
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.channels.browserPush && pushPerm === "granted"}
                disabled={pushPerm === "denied" || pushPerm === "unsupported"}
                onCheckedChange={(v) => void updateChannel("browserPush", v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="text-[11px] text-muted-foreground">
                    Eventos importantes no e-mail cadastrado
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.channels.email}
                onCheckedChange={(v) => updateChannel("email", v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <CalendarClock size={14} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Resumo diário por e-mail (9h)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Lista de demandas em aberto toda manhã, dias úteis
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.dailyReminder ?? true}
                onCheckedChange={updateDailyReminder}
              />
            </div>
          </div>
        </div>

        {/* EVENTOS */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Quais eventos te notificam</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVENT_ORDER.map((event) => (
              <div
                key={event}
                className="flex items-center justify-between p-2.5 rounded-lg border text-sm"
              >
                <span>{EVENT_LABELS[event].label}</span>
                <Switch
                  checked={prefs.events[event] !== false}
                  onCheckedChange={(v) => updateEvent(event, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* SLA REMINDERS */}
        <div>
          <h3 className="text-sm font-semibold mb-1">Lembretes de SLA</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Quantas horas antes do vencimento te avisar (por prioridade).
            Valor 0 desativa o lembrete pra essa prioridade.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">P1 (Crítico)</label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={48}
                  value={prefs.slaReminders.p1Hours}
                  onChange={(e) => updateSlaReminder("p1Hours", Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">h</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">P2 (Alta)</label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={48}
                  value={prefs.slaReminders.p2Hours}
                  onChange={(e) => updateSlaReminder("p2Hours", Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">h</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">P3 (Média)</label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={48}
                  value={prefs.slaReminders.p3Hours}
                  onChange={(e) => updateSlaReminder("p3Hours", Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">h</span>
              </div>
            </div>
          </div>
        </div>

        {/* SAVE */}
        <div className="flex justify-end pt-2 border-t">
          <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationPreferencesCard;
