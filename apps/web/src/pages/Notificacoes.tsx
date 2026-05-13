/**
 * Pagina /notificacoes — central de notificacoes do usuario logado.
 *
 * 3 abas: Pendentes (nao lidas), Registro (ja lidas), Todas.
 * Cada card mostra: tipo + origem + titulo da demanda + mensagem
 * detalhada + actor + timestamp. Botoes "Abrir demanda" (navega via
 * ?openId=) e "Marcar lida".
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCheck, Settings, Loader2, Inbox, ExternalLink, Check, RotateCcw as Undo,
  AlertCircle, MessageSquare, CheckCircle2, Clock, UserCheck, RotateCcw, Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/apiClient";
import { NotificationItem, NotificationEvent } from "@/types/notification";

type Filter = "pendentes" | "registro" | "todas";

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

const EVENT_LABEL_PT: Record<NotificationEvent, string> = {
  demand_assigned: "Atribuída",
  demand_replied: "Resposta",
  demand_started: "Iniciada",
  demand_completed: "Concluída",
  demand_reopened: "Reaberta",
  demand_overdue: "SLA estourado",
  demand_due_soon: "SLA vencendo",
  demand_created: "Nova demanda",
};

function EventBadge({ event }: { event: NotificationEvent }) {
  const cls: Record<NotificationEvent, string> = {
    demand_assigned: "bg-info/10 text-info border-info/30",
    demand_replied: "bg-primary/10 text-primary border-primary/30",
    demand_started: "bg-info/10 text-info border-info/30",
    demand_completed: "bg-success/10 text-success border-success/30",
    demand_reopened: "bg-warning/10 text-warning border-warning/30",
    demand_overdue: "bg-destructive/10 text-destructive border-destructive/30",
    demand_due_soon: "bg-warning/10 text-warning border-warning/30",
    demand_created: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${cls[event]}`}>
      {EVENT_LABEL_PT[event]}
    </span>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "agora";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

const Notificacoes = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pendentes");

  const email = currentUser?.email || "";

  const reload = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await apiClient.notifications.list(email);
      setItems(r.notifications || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isAuth = /unauthorized|401/i.test(msg);
      if (!isAuth) {
        toast({
          title: "Erro ao carregar notificações",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [email, toast]);

  useEffect(() => { void reload(); }, [reload]);

  const unreadCount = items.filter((n) => !n.read).length;
  const readCount = items.length - unreadCount;

  const filtered = items.filter((n) => {
    if (filter === "pendentes") return !n.read;
    if (filter === "registro") return n.read;
    return true;
  });

  /** Abre a demanda especifica via query param. Marca lida no caminho. */
  const openDemand = async (n: NotificationItem) => {
    if (!n.read) {
      await apiClient.notifications.markRead(n.id, true);
      void reload();
    }
    const base = n.source === "infra" ? "/infra" : "/demandas";
    navigate(`${base}?openId=${encodeURIComponent(n.demandId)}`);
  };

  /** So marca como lida (sem navegar). Tira da aba Pendentes pra Registro. */
  const markRead = async (n: NotificationItem, read: boolean) => {
    await apiClient.notifications.markRead(n.id, read);
    void reload();
  };

  const handleMarkAllRead = async () => {
    await apiClient.notifications.markAllRead(email);
    toast({ title: `${unreadCount} notificações marcadas como lidas` });
    void reload();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Bell size={22} className="text-primary" /> Notificações
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "Sem notificações por enquanto"
                : `${unreadCount} pendente${unreadCount !== 1 ? "s" : ""} · ${readCount} no registro`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2">
                <CheckCheck size={14} /> Marcar todas como lidas
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/configuracoes")} className="gap-2">
              <Settings size={14} /> Preferências
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="pendentes">
              Pendentes <span className="ml-2 text-xs text-muted-foreground">({unreadCount})</span>
            </TabsTrigger>
            <TabsTrigger value="registro">
              Registro <span className="ml-2 text-xs text-muted-foreground">({readCount})</span>
            </TabsTrigger>
            <TabsTrigger value="todas">
              Todas <span className="ml-2 text-xs text-muted-foreground">({items.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Inbox size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {filter === "pendentes" && "Tudo lido ✨ — sem pendências"}
                {filter === "registro" && "Nenhuma notificação no registro ainda"}
                {filter === "todas" && "Nenhuma notificação ainda"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const Icon = EVENT_ICON[n.event] || Bell;
              return (
                <Card
                  key={n.id}
                  className={`transition-all hover:shadow-sm ${
                    !n.read ? "bg-primary/5 border-primary/20 hover:border-primary/40" : "opacity-90"
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${!n.read ? "text-primary" : "text-muted-foreground"}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Linha 1: badges + título da demanda */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <EventBadge event={n.event} />
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border">
                            {n.source === "infra" ? "Infra" : "Slack"}
                          </span>
                          {!n.read && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
                              novo
                            </span>
                          )}
                        </div>
                        {/* Linha 2: título da demanda (destacado) */}
                        <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium"} truncate`}>
                          {n.title}
                        </p>
                        {/* Linha 3: mensagem detalhada (contexto + ação) */}
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        {/* Linha 4: timestamp + ações */}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(n.createdAt)} · {fmtDateTime(n.createdAt)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDemand(n)}
                              className="h-7 text-[11px] gap-1"
                            >
                              <ExternalLink size={11} /> Abrir demanda
                            </Button>
                            {n.read ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markRead(n, false)}
                                className="h-7 text-[11px] gap-1"
                                title="Voltar pra pendentes"
                              >
                                <Undo size={11} /> Pendente
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markRead(n, true)}
                                className="h-7 text-[11px] gap-1"
                                title="Marcar como lida (vai pra Registro)"
                              >
                                <Check size={11} /> Marcar lida
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Notificacoes;
