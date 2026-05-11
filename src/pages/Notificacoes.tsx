/**
 * Pagina completa de notificacoes do usuario logado.
 * Lista paginada (todas as 500 mais recentes do storage) com filtros
 * por status (todas/nao lidas) e por tipo de evento.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCheck, Settings, Loader2, Inbox,
  AlertCircle, MessageSquare, CheckCircle2, Clock, UserCheck, RotateCcw, Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/apiClient";
import { NotificationItem, NotificationEvent } from "@/types/notification";

type Filter = "todas" | "nao_lidas";

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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const Notificacoes = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todas");

  const email = currentUser?.email || "";

  const reload = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await apiClient.notifications.list(email);
      setItems(r.notifications || []);
    } catch (e) {
      toast({
        title: "Erro ao carregar notificações",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [email, toast]);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = items.filter((n) => filter === "todas" || !n.read);
  const unreadCount = items.filter((n) => !n.read).length;

  const handleClick = async (n: NotificationItem) => {
    if (!n.read) {
      await apiClient.notifications.markRead(n.id, true);
      void reload();
    }
    navigate(n.source === "infra" ? "/infra" : "/demandas");
  };

  const handleToggleRead = async (n: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiClient.notifications.markRead(n.id, !n.read);
    void reload();
  };

  const handleMarkAllRead = async () => {
    await apiClient.notifications.markAllRead(email);
    toast({ title: `Marcadas ${unreadCount} como lidas` });
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
                : `${items.length} no total · ${unreadCount} não lida${unreadCount !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2">
                <CheckCheck size={14} /> Marcar todas como lidas
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/perfil/notificacoes")} className="gap-2">
              <Settings size={14} /> Preferências
            </Button>
          </div>
        </div>

        {/* Filtro */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="todas">
              Todas <span className="ml-2 text-xs text-muted-foreground">({items.length})</span>
            </TabsTrigger>
            <TabsTrigger value="nao_lidas">
              Não lidas <span className="ml-2 text-xs text-muted-foreground">({unreadCount})</span>
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
                {filter === "nao_lidas" ? "Tudo lido ✨" : "Nenhuma notificação ainda"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((n) => {
              const Icon = EVENT_ICON[n.event] || Bell;
              return (
                <Card
                  key={n.id}
                  className={`cursor-pointer transition-all hover:shadow-sm hover:border-primary/30 ${
                    !n.read ? "bg-primary/5 border-primary/20" : ""
                  }`}
                  onClick={() => handleClick(n)}
                >
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className={`mt-0.5 ${!n.read ? "text-primary" : "text-muted-foreground"}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted border font-medium">
                          {EVENT_LABEL_PT[n.event]}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border">
                          {n.source === "infra" ? "Infra" : "Slack"}
                        </span>
                        <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium"} flex-1 truncate`}>
                          {n.title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        {n.actor && <span>por <strong className="text-foreground">{n.actor}</strong></span>}
                        {n.actor && <span>·</span>}
                        <span>{fmtDateTime(n.createdAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] shrink-0"
                      onClick={(e) => handleToggleRead(n, e)}
                      title={n.read ? "Marcar como não lida" : "Marcar como lida"}
                    >
                      {n.read ? "Marcar não lida" : "Marcar lida"}
                    </Button>
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
