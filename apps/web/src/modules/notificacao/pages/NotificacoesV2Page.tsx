/**
 * /notificacoes-v2 — inbox consumindo /api/v1/notificacoes.
 *
 * Padrao Just: React Query + apiClient JWT. Coexiste com /notificacoes
 * legacy.
 */
import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell, CheckCheck, Loader2, Inbox, Check, RotateCcw,
  AlertCircle, MessageSquare, CheckCircle2, Clock, UserCheck, Plus,
} from 'lucide-react';
import {
  useNotificacoes, useMarkRead, useMarkAllRead,
  type Notificacao, type NotificationEvent,
} from '@/modules/notificacao';
import { toApiError } from '@/lib/api/client';
import { useLanguage } from '@/contexts/LanguageContext';

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

// Mapa de evento -> chave i18n curta (label compacto pra badge).
// O label completo vive em notifications.event.* (usado pelo bell).
const EVENT_LABEL_KEY: Record<NotificationEvent, string> = {
  demand_assigned: 'notif_short.demand_assigned',
  demand_replied: 'notif_short.demand_replied',
  demand_started: 'notif_short.demand_started',
  demand_completed: 'notif_short.demand_completed',
  demand_reopened: 'notif_short.demand_reopened',
  demand_overdue: 'notif_short.demand_overdue',
  demand_due_soon: 'notif_short.demand_due_soon',
  demand_created: 'notif_short.demand_created',
};

type Filter = 'pendentes' | 'registro' | 'todas';

type T = (key: string, params?: Record<string, string | number>) => string;

function timeAgo(iso: string, t: T): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return t('time.now');
  const min = Math.floor(ms / 60_000);
  if (min < 60) return t('time.minutes_ago_short', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('time.hours_ago_short', { count: h });
  return t('time.days_ago_short', { count: Math.floor(h / 24) });
}

const NotificacoesV2Page = () => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('pendentes');
  // Polling a cada 30s pra refletir notificacoes recem-criadas
  const { data: notificacoes, isLoading, error } = useNotificacoes({
    refetchInterval: 30_000,
  });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = notificacoes ?? [];
  const unread = items.filter((n) => !n.lida).length;
  const read = items.length - unread;

  const filtered = items.filter((n) => {
    if (filter === 'pendentes') return !n.lida;
    if (filter === 'registro') return n.lida;
    return true;
  });

  const handleMarkRead = (n: Notificacao, lida: boolean): void => {
    void markRead.mutateAsync({ id: n.id, lida });
  };

  return (
    <AppLayout>
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Bell size={22} className="text-primary" /> {t('notif_page.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? t('notif_page.empty_status')
                : `${unread === 1
                    ? t('notif_page.status_pending_one', { count: unread })
                    : t('notif_page.status_pending_other', { count: unread })} · ${t('notif_page.status_in_history', { count: read })}`}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void markAllRead.mutateAsync()}
              disabled={markAllRead.isPending}
              className="gap-2"
            >
              <CheckCheck size={14} /> {t('notifications.mark_all_read')}
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="pendentes">
              {t('notif_page.tab.pending')} <span className="ml-2 text-xs text-muted-foreground">({unread})</span>
            </TabsTrigger>
            <TabsTrigger value="registro">
              {t('notif_page.tab.history')} <span className="ml-2 text-xs text-muted-foreground">({read})</span>
            </TabsTrigger>
            <TabsTrigger value="todas">
              {t('notif_page.tab.all')} <span className="ml-2 text-xs text-muted-foreground">({items.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> {t('notifications.loading')}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive text-sm">
              {toApiError(error).message}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Inbox size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {filter === 'pendentes' && t('notif_page.empty_pending')}
                {filter === 'registro' && t('notif_page.empty_history')}
                {filter === 'todas' && t('notif_page.empty_all')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const Icon = EVENT_ICON[n.evento] || Bell;
              return (
                <Card
                  key={n.id}
                  className={n.lida ? 'opacity-90' : 'bg-primary/5 border-primary/20'}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${!n.lida ? 'text-primary' : 'text-muted-foreground'}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                            {EVENT_LABEL_KEY[n.evento] ? t(EVENT_LABEL_KEY[n.evento]) : n.evento}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border">
                            {n.origem}
                          </span>
                          {!n.lida && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
                              {t('notif_page.new_badge')}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${!n.lida ? 'font-semibold' : 'font-medium'} truncate`}>
                          {n.titulo}
                        </p>
                        {n.mensagem && (
                          <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(n.criadoEm, t)} {n.ator && `· ${t('notifications.by_actor', { actor: n.ator })}`}
                          </span>
                          {n.lida ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkRead(n, false)}
                              className="h-7 text-[11px] gap-1"
                            >
                              <RotateCcw size={11} /> {t('notif_page.mark_unread')}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkRead(n, true)}
                              className="h-7 text-[11px] gap-1"
                            >
                              <Check size={11} /> {t('notif_page.mark_read')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* hint dev removido — pagina v2 ja eh a oficial */}
      </div>
    </AppLayout>
  );
};

export default NotificacoesV2Page;
