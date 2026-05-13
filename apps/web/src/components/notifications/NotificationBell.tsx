/**
 * Sino de notificacoes — fica no header (canto superior direito).
 *
 * Mostra badge com contagem de nao lidas. Click abre dropdown com
 * ultimas 10 notificacoes. Botao "Ver todas" leva a /notificacoes.
 *
 * Polling: 30s pra detectar novas. Pra evitar trafico em demo, so
 * roda se user logado e nao em demo mode.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, AlertCircle, MessageSquare, Loader2, CheckCircle2, Clock, UserCheck, RotateCcw, Plus } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { NotificationItem, NotificationEvent } from "@/types/notification";

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
  if (ms < 60_000) return "agora";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

const NotificationBell = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const email = currentUser?.email || "";

  const reload = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await apiClient.notifications.list(email);
      setItems(r.notifications || []);
    } catch {
      /* silencia — sino nao deve quebrar */
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (!email) return;
    void reload();
    const id = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [email, reload]);

  // Recarrega ao abrir o popover (refresh imediato)
  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const unreadCount = items.filter((n) => !n.read).length;

  const handleClick = async (n: NotificationItem) => {
    setOpen(false);
    // Marca lida em background
    if (!n.read) {
      void apiClient.notifications.markRead(n.id, true).then(reload);
    }
    // Navega pro modulo correspondente
    if (n.source === "infra") {
      navigate("/infra");
    } else {
      navigate("/demandas");
    }
  };

  const handleMarkAllRead = async () => {
    if (!email) return;
    await apiClient.notifications.markAllRead(email);
    void reload();
  };

  if (!email) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Notificações"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 max-h-[500px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell size={14} />
            <span className="font-medium text-sm">Notificações</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {unreadCount} nova{unreadCount > 1 ? "s" : ""}
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
              <CheckCheck size={11} /> Marcar todas
            </Button>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin inline mr-1.5" /> Carregando...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Bell size={20} className="mx-auto mb-2 opacity-40" />
              Nenhuma notificação ainda
            </div>
          ) : (
            <div className="divide-y">
              {items.slice(0, 10).map((n) => {
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
                          por {n.actor}
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
              onClick={() => { setOpen(false); navigate("/notificacoes"); }}
            >
              Ver todas as notificações
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
