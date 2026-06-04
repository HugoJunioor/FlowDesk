/**
 * Variante do sino de notificacoes pro Sidebar.
 *
 * Mesma logica do NotificationBell (popover + polling + badge), mas
 * com visual de nav-item — alinha com os outros links do sidebar.
 *
 * Adapta ao estado collapsed (so icone + badge) ou aberto (icone + label).
 *
 * Polling: para automaticamente em 401 (usePollingWithBackoff) e
 * resume em visibilitychange ou click do usuario.
 * Notificacoes desktop: via useDesktopNotifications, dispara push
 * pras novas desde a ultima carga (nao exibe na primeira — anti-spam).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CheckCheck, AlertCircle, MessageSquare, Loader2,
  CheckCircle2, Clock, UserCheck, RotateCcw, Plus,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/apiClient";
import { NotificationItem, NotificationEvent } from "@/types/notification";
import { showBrowserNotification, getPermission } from "@/lib/browserNotifications";
import { runSlaReminderCheck } from "@/lib/slaReminderEngine";
import { NotificationPreferences, DEFAULT_PREFERENCES } from "@/types/notification";
import { getProcessedDemands } from "@/data/demandsLoader";
import { usePollingWithBackoff } from "@/hooks/usePollingWithBackoff";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";

const POLL_INTERVAL_MS = 30_000;

const EVENT_ICON: Record<NotificationEvent, typeof Bell> = {
  demand_assigned: UserCheck,
  demand_replied: MessageSquare,
  demand_started: Loader2,
  demand_completed: CheckCircle2,
  demand_reopened: RotateCcw,
  demand_overdue: AlertCircle,
  demand_due_soon: Clock,
  demand_created: Plus,
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "agora"; // util fora do componente — refactor i18n em PR futuro
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

interface NotificationBellSidebarProps {
  collapsed: boolean;
  onClick?: () => void;
}

const NotificationBellSidebar = ({ collapsed, onClick }: NotificationBellSidebarProps) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  // IDs ja vistos no polling — usado pra detectar notificacoes NOVAS
  // e disparar push do navegador uma unica vez por id.
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Flag pra nao disparar push na PRIMEIRA carga (notificacoes antigas
  // nao devem virar push agora). Inicia false, vira true apos 1a list.
  const initializedRef = useRef(false);
  // Cache da preferencia push do user (atualizada via prefs api).
  const pushEnabledRef = useRef(false);
  // Preferencias completas pro engine de lembretes SLA
  const prefsRef = useRef<NotificationPreferences | null>(null);

  const email = currentUser?.email || "";

  // Hook de notificacoes desktop (throttle + permissao)
  const { notify: notifyDesktop } = useDesktopNotifications();

  // Carrega preferencias do user (push enabled + SLA reminders)
  useEffect(() => {
    if (!email) return;
    apiClient.notifications.getPreferences(email)
      .then((r) => {
        const merged: NotificationPreferences = r.preferences
          ? { ...DEFAULT_PREFERENCES, ...r.preferences, userEmail: email }
          : { userEmail: email, ...DEFAULT_PREFERENCES };
        prefsRef.current = merged;
        pushEnabledRef.current = merged.channels.browserPush === true;
      })
      .catch(() => {
        prefsRef.current = { userEmail: email, ...DEFAULT_PREFERENCES };
        pushEnabledRef.current = false;
      });
  }, [email]);

  const fetchNotifications = useCallback(async () => {
    if (!email) return;
    setLoading(true);

    // Engine de lembretes SLA — roda antes do list pra que as
    // notificacoes criadas ja apareçam no proximo fetch.
    if (currentUser && prefsRef.current) {
      try {
        const infraRes = await apiClient.infra.list().catch(() => ({ demands: [] }));
        const allDemands = [...(infraRes.demands || []), ...getProcessedDemands()];
        await runSlaReminderCheck({
          user: currentUser,
          prefs: prefsRef.current,
          demands: allDemands,
        });
      } catch (e) {
        console.warn("[sla-reminder] check falhou:", e);
      }
    }

    try {
      const r = await apiClient.notifications.list(email);
      const fetched = r.notifications || [];

      // Detecta novas (presentes no fetch mas nao no set anterior)
      const previouslySeen = seenIdsRef.current;
      const newOnes = initializedRef.current
        ? fetched.filter((n) => !previouslySeen.has(n.id) && !n.read)
        : [];

      // Atualiza set de vistos com TUDO que veio (lidas + nao lidas)
      const newSet = new Set<string>();
      fetched.forEach((n) => newSet.add(n.id));
      seenIdsRef.current = newSet;
      initializedRef.current = true;

      // Dispara push do navegador pras novas.
      // Prioridade: useDesktopNotifications (throttle por categoria).
      // Fallback: showBrowserNotification direto (prefs legadas da API).
      if (newOnes.length > 0) {
        for (const n of newOnes) {
          const base = n.source === "infra" ? "/infra" : "/demandas";
          const url = `${base}?openId=${encodeURIComponent(n.demandId)}`;

          const sentViaHook = notifyDesktop({
            category: n.event,
            title: n.title,
            body: n.message,
            tag: n.id,
            url,
          });

          // Fallback legado: pushEnabledRef (prefs da API)
          if (!sentViaHook && pushEnabledRef.current && getPermission() === "granted") {
            showBrowserNotification({ title: n.title, body: n.message, tag: n.id, url });
          }
        }
      }

      setItems(fetched);
    } finally {
      setLoading(false);
    }
  }, [email, currentUser, notifyDesktop]);

  const { runNow } = usePollingWithBackoff(fetchNotifications, POLL_INTERVAL_MS, {
    enabled: !!email,
  });

  // Carga inicial
  useEffect(() => {
    if (email) void fetchNotifications();
  }, [email, fetchNotifications]);

  // Recarrega ao abrir o popover
  useEffect(() => {
    if (open) runNow();
  }, [open, runNow]);

  const unreadCount = items.filter((n) => !n.read).length;

  const handleClick = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.read) {
      void apiClient.notifications.markRead(n.id, true).then(fetchNotifications);
    }
    onClick?.();
    const base = n.source === "infra" ? "/infra" : "/demandas";
    navigate(`${base}?openId=${encodeURIComponent(n.demandId)}`);
  };

  const handleMarkAllRead = async () => {
    if (!email) return;
    await apiClient.notifications.markAllRead(email);
    void fetchNotifications();
  };

  if (!email) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          aria-label="Notificações"
        >
          <div className="relative shrink-0">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="flex-1 text-left">
              Notificações
              {unreadCount > 0 && (
                <span className="ml-1.5 text-[10px] text-primary font-semibold">
                  {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-[380px] p-0 max-h-[500px] overflow-hidden flex flex-col ml-2">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell size={14} />
            <span className="font-medium text-sm">{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {unreadCount === 1
                  ? t("notifications.unread_count_one", { count: unreadCount })
                  : t("notifications.unread_count_other", { count: unreadCount })}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={handleMarkAllRead}
            >
              <CheckCheck size={11} /> {t("notifications.mark_all_read")}
            </Button>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin inline mr-1.5" /> {t("notifications.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Bell size={20} className="mx-auto mb-2 opacity-40" />
              {t("notifications.empty")}
            </div>
          ) : (
            <div className="divide-y">
              {/* Quantidade exibida: minimo 4 (compacto quando pouco
                  pendente); se tiver muitas nao lidas, mostra todas elas
                  ate um teto de 15 pra nao crescer demais. */}
              {items.slice(0, Math.max(4, Math.min(unreadCount, 15))).map((n) => {
                const Icon = EVENT_ICON[n.event] || Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left p-3 hover:bg-muted/40 transition-colors flex gap-3 ${
                      !n.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className={`mt-0.5 ${!n.read ? "text-primary" : "text-muted-foreground"}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs ${!n.read ? "font-semibold" : "font-medium"} truncate`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {n.message}
                      </p>
                      {n.actor && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {t("notifications.by_actor", { actor: n.actor })}
                        </p>
                      )}
                    </div>
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => { setOpen(false); onClick?.(); navigate("/notificacoes"); }}
            >
              {t("notifications.see_all")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBellSidebar;
