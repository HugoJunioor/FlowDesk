/**
 * Card de preferencias de notificacao — fica em /configuracoes.
 *
 * Estrutura em abas por canal (Inbox / Push / E-mail / Telegram).
 * Cada aba tem:
 *   - Toggle master do canal (habilita/desabilita o canal inteiro)
 *   - Lista de eventos: por canal voce decide quais te notificam ali
 *     (override sobre o default global definido em events)
 *
 * SLA reminders e resumo diario ficam abaixo (independentes de canal).
 *
 * Persistencia via apiClient.notifications (rota /notifications/preferences).
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Save, Mail, BellRing, Inbox, AlertCircle, CheckCircle2, CalendarClock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import {
  NotificationPreferences,
  DEFAULT_PREFERENCES,
  EVENT_LABELS,
  NotificationEvent,
  ChannelKey,
  isEventEnabledForChannel,
} from "@/types/notification";
import {
  requestBrowserNotificationPermission,
  getPermission,
  isBrowserNotificationSupported,
  showBrowserNotification,
} from "@/lib/browserNotifications";
import { subscribePush, unsubscribePush, isPushSupported } from "@/lib/pushSubscription";

const EVENT_ORDER: NotificationEvent[] = [
  "demand_assigned",
  "demand_replied",
  "demand_started",
  "demand_completed",
  "demand_reopened",
  "demand_overdue",
  "demand_due_soon",
  "demand_approved",
  "demand_rejected",
  "demand_created",
];

const CHANNELS: Array<{
  key: ChannelKey;
  label: string;
  short: string;
  icon: typeof Inbox;
  description: string;
}> = [
  { key: "inbox", label: "Inbox no FlowDesk", short: "Inbox", icon: Inbox, description: "Sino na sidebar — sempre ativo." },
  { key: "browserPush", label: "Push do navegador", short: "Push", icon: BellRing, description: "Notificações do sistema operacional." },
  { key: "email", label: "E-mail", short: "E-mail", icon: Mail, description: "Recebe no e-mail cadastrado." },
  { key: "telegram", label: "Telegram", short: "Telegram", icon: Send, description: "Mensagens diretas no bot conectado." },
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
        const merged: NotificationPreferences = r.preferences
          ? { ...DEFAULT_PREFERENCES, ...r.preferences, userEmail: email }
          : { userEmail: email, ...DEFAULT_PREFERENCES };
        // Garante campos novos em prefs antigos
        if (!merged.channels.telegram && merged.channels.telegram === undefined) {
          merged.channels = { ...merged.channels, telegram: true };
        }
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

  const setChannelEvent = (channel: ChannelKey, event: NotificationEvent, enabled: boolean) => {
    if (!prefs) return;
    const cur = prefs.eventsByChannel || {};
    const curCh = cur[channel] || {};
    setPrefs({
      ...prefs,
      eventsByChannel: {
        ...cur,
        [channel]: { ...curCh, [event]: enabled },
      },
    });
    setDirty(true);
  };

  const updateDailyReminder = (enabled: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, dailyReminder: enabled });
    setDirty(true);
  };

  const updateChannelEnabled = async (channel: ChannelKey, enabled: boolean) => {
    if (!prefs) return;
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
      if (perm !== "granted") return;
      showBrowserNotification({
        title: "FlowDesk · Notificações ativas",
        body: "Você vai receber novidades aqui daqui pra frente.",
        tag: `setup_push_${Date.now()}`,
      });
      // Service Worker + Web Push: funciona com aba fechada (precisa do server VAPID configurado)
      if (isPushSupported()) {
        try {
          const ok = await subscribePush();
          if (ok) {
            toast({ title: "Push em background ativado", description: "Você recebe mesmo com a aba fechada." });
          } else {
            toast({ title: "Push apenas com aba aberta", description: "Servidor sem chaves VAPID — push em background não disponível." });
          }
        } catch (err) {
          console.warn("[push] subscribe falhou:", err);
        }
      }
    }
    if (channel === "browserPush" && !enabled) {
      // Desliga subscription tambem no server
      void unsubscribePush().catch(() => { /* ignore */ });
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

  const renderChannelTab = (ch: typeof CHANNELS[number]) => {
    const Icon = ch.icon;
    const channelEnabled = ch.key === "inbox" ? true : !!prefs.channels[ch.key];
    const isPushPermDenied = ch.key === "browserPush" && (pushPerm === "denied" || pushPerm === "unsupported");

    return (
      <div className="space-y-4">
        {/* Header do canal */}
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-start gap-3">
            <Icon size={16} className="text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">{ch.label}</p>
              <p className="text-[11px] text-muted-foreground">{ch.description}</p>
              {ch.key === "browserPush" && (
                <p className="text-[11px] mt-1">
                  {pushPerm === "granted" && (
                    <span className="inline-flex items-center gap-0.5 text-success">
                      <CheckCircle2 size={10} /> permitido
                    </span>
                  )}
                  {pushPerm === "denied" && (
                    <span className="inline-flex items-center gap-0.5 text-destructive">
                      <AlertCircle size={10} /> bloqueado no navegador
                    </span>
                  )}
                  {pushPerm === "default" && (
                    <span className="text-warning">pedirá permissão ao ativar</span>
                  )}
                  {pushPerm === "unsupported" && (
                    <span className="text-muted-foreground italic">não suportado</span>
                  )}
                </p>
              )}
              {ch.key === "telegram" && (
                <p className="text-[11px] text-muted-foreground italic mt-1">
                  Conecte sua conta em Telegram (card abaixo) pra começar a receber.
                </p>
              )}
            </div>
          </div>
          <Switch
            checked={channelEnabled}
            disabled={ch.key === "inbox" || isPushPermDenied}
            onCheckedChange={(v) => void updateChannelEnabled(ch.key, v)}
          />
        </div>

        {/* Lista de eventos pro canal */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Eventos que disparam por este canal
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVENT_ORDER.map((event) => {
              const enabled = isEventEnabledForChannel(prefs, ch.key, event);
              return (
                <div
                  key={event}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${channelEnabled ? "" : "opacity-50"}`}
                >
                  <span>{EVENT_LABELS[event].label}</span>
                  <Switch
                    checked={enabled}
                    disabled={!channelEnabled}
                    onCheckedChange={(v) => setChannelEvent(ch.key, event, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell size={16} className="text-primary" />
          Notificações
        </CardTitle>
        <CardDescription>
          Configure individualmente cada canal — quais eventos te notificam por inbox, push, e-mail e Telegram.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue="inbox">
          <TabsList className="grid grid-cols-4 w-full">
            {CHANNELS.map((ch) => (
              <TabsTrigger key={ch.key} value={ch.key} className="text-xs">
                <ch.icon size={12} className="mr-1.5" />
                {ch.short}
              </TabsTrigger>
            ))}
          </TabsList>
          {CHANNELS.map((ch) => (
            <TabsContent key={ch.key} value={ch.key} className="mt-4">
              {renderChannelTab(ch)}
            </TabsContent>
          ))}
        </Tabs>

        {/* DIÁRIO + SLA — independentes de canal */}
        <div className="pt-2 border-t space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <CalendarClock size={14} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Resumo diário por e-mail (9h)</p>
                <p className="text-[11px] text-muted-foreground">
                  Lista de demandas em aberto toda manhã, dias úteis.
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.dailyReminder ?? true}
              onCheckedChange={updateDailyReminder}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-1">Lembretes de SLA</h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Quantas horas antes do vencimento te avisar (por prioridade).
              Valor 0 desativa o lembrete pra essa prioridade.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(["p1Hours", "p2Hours", "p3Hours"] as const).map((k) => (
                <div className="space-y-1.5" key={k}>
                  <label className="text-xs font-medium">
                    {k === "p1Hours" ? "P1 (Crítico)" : k === "p2Hours" ? "P2 (Alta)" : "P3 (Média)"}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={48}
                      value={prefs.slaReminders[k]}
                      onChange={(e) => updateSlaReminder(k, Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">h</span>
                  </div>
                </div>
              ))}
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
