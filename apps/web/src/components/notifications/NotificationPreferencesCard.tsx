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
import { useLanguage } from "@/contexts/LanguageContext";
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

// Canais sao definidos por chaves i18n — labels resolvidos em render.
// Pra trocar o conjunto de canais, edite tanto este array quanto o
// dict em i18n.ts (notifications.channel.*).
const CHANNEL_KEYS: Array<{
  key: ChannelKey;
  labelKey: string;
  shortKey: string;
  icon: typeof Inbox;
  descKey: string;
}> = [
  { key: "inbox", labelKey: "notifications.channel.inbox.label", shortKey: "notifications.channel.inbox.short", icon: Inbox, descKey: "notifications.channel.inbox.description" },
  { key: "browserPush", labelKey: "notifications.channel.push.label", shortKey: "notifications.channel.push.short", icon: BellRing, descKey: "notifications.channel.push.description" },
  { key: "email", labelKey: "notifications.channel.email.label", shortKey: "notifications.channel.email.short", icon: Mail, descKey: "notifications.channel.email.description" },
  { key: "telegram", labelKey: "notifications.channel.telegram.label", shortKey: "notifications.channel.telegram.short", icon: Send, descKey: "notifications.channel.telegram.description" },
];

const NotificationPreferencesCard = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
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
    const globalDefault = prefs.events?.[event] !== false; // global default permissivo
    const cur = prefs.eventsByChannel || {};
    const curCh = { ...(cur[channel] || {}) };

    if (enabled === globalDefault) {
      // Voltou pro default global — apaga o override (evita override "preso" em false)
      delete curCh[event];
    } else {
      curCh[event] = enabled;
    }

    const nextChannel = Object.keys(curCh).length > 0 ? curCh : undefined;
    const nextByChannel = { ...cur };
    if (nextChannel) {
      nextByChannel[channel] = nextChannel;
    } else {
      delete nextByChannel[channel];
    }
    const finalByChannel = Object.keys(nextByChannel).length > 0 ? nextByChannel : undefined;

    setPrefs({ ...prefs, eventsByChannel: finalByChannel });
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
          title: t("notifications.toast.browser_unsupported"),
          description: t("notifications.toast.browser_unsupported_desc"),
          variant: "destructive",
        });
        return;
      }
      const perm = await requestBrowserNotificationPermission();
      setPushPerm(perm);
      if (perm === "denied") {
        toast({
          title: t("notifications.toast.permission_denied"),
          description: t("notifications.toast.permission_denied_desc"),
          variant: "destructive",
        });
        return;
      }
      if (perm !== "granted") return;
      showBrowserNotification({
        title: t("notifications.toast.push_active"),
        body: t("notifications.toast.push_active_body"),
        tag: `setup_push_${Date.now()}`,
      });
      // Service Worker + Web Push: funciona com aba fechada (precisa do server VAPID configurado)
      if (isPushSupported()) {
        try {
          const ok = await subscribePush();
          if (ok) {
            toast({ title: t("notifications.toast.push_bg_enabled"), description: t("notifications.toast.push_bg_enabled_desc") });
          } else {
            toast({ title: t("notifications.toast.push_tab_only"), description: t("notifications.toast.push_tab_only_desc") });
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
          <Loader2 size={16} className="animate-spin inline mr-2" /> {t("notifications.prefs.loading_prefs")}
        </CardContent>
      </Card>
    );
  }

  const renderChannelTab = (ch: typeof CHANNEL_KEYS[number]) => {
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
              <p className="text-sm font-medium">{t(ch.labelKey)}</p>
              <p className="text-[11px] text-muted-foreground">{t(ch.descKey)}</p>
              {ch.key === "browserPush" && (
                <p className="text-[11px] mt-1">
                  {pushPerm === "granted" && (
                    <span className="inline-flex items-center gap-0.5 text-success">
                      <CheckCircle2 size={10} /> {t("notifications.push.allowed")}
                    </span>
                  )}
                  {pushPerm === "denied" && (
                    <span className="inline-flex items-center gap-0.5 text-destructive">
                      <AlertCircle size={10} /> {t("notifications.push.denied")}
                    </span>
                  )}
                  {pushPerm === "default" && (
                    <span className="text-warning">{t("notifications.push.default")}</span>
                  )}
                  {pushPerm === "unsupported" && (
                    <span className="text-muted-foreground italic">{t("notifications.push.unsupported")}</span>
                  )}
                </p>
              )}
              {ch.key === "telegram" && (
                <p className="text-[11px] text-muted-foreground italic mt-1">
                  {t("notifications.channel.telegram.connect_hint")}
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
            {t("notifications.prefs.events_for_channel")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVENT_ORDER.map((event) => {
              const enabled = isEventEnabledForChannel(prefs, ch.key, event);
              return (
                <div
                  key={event}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${channelEnabled ? "" : "opacity-50"}`}
                >
                  <span>{t(EVENT_LABELS[event].labelKey)}</span>
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
          {t("notifications.prefs.title")}
        </CardTitle>
        <CardDescription>
          {t("notifications.prefs.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue="inbox">
          <TabsList className="grid grid-cols-4 w-full">
            {CHANNEL_KEYS.map((ch) => (
              <TabsTrigger key={ch.key} value={ch.key} className="text-xs">
                <ch.icon size={12} className="mr-1.5" />
                {t(ch.shortKey)}
              </TabsTrigger>
            ))}
          </TabsList>
          {CHANNEL_KEYS.map((ch) => (
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
                <p className="text-sm font-medium">{t("notifications.prefs.daily_title")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("notifications.prefs.daily_description")}
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.dailyReminder ?? true}
              onCheckedChange={updateDailyReminder}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-1">{t("notifications.prefs.sla_title")}</h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              {t("notifications.prefs.sla_description")}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(["p1Hours", "p2Hours", "p3Hours"] as const).map((k) => (
                <div className="space-y-1.5" key={k}>
                  <label className="text-xs font-medium">
                    {k === "p1Hours" ? t("dashboard.chart.priority.p1") : k === "p2Hours" ? t("dashboard.chart.priority.p2") : t("dashboard.chart.priority.p3")}
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
            {t("notifications.prefs.save_button")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationPreferencesCard;
