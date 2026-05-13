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

const EVENT_LABEL: Record<NotificationEvent, string> = {
  demand_assigned: 'Atribuída',
  demand_replied: 'Resposta',
  demand_started: 'Iniciada',
  demand_completed: 'Concluída',
  demand_reopened: 'Reaberta',
  demand_overdue: 'SLA estourado',
  demand_due_soon: 'SLA vencendo',
  demand_created: 'Nova',
};

type Filter = 'pendentes' | 'registro' | 'todas';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'agora';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

const NotificacoesV2Page = () => {
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
              <Bell size={22} className="text-primary" /> Notificações (v2)
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? 'Sem notificações'
                : `${unread} pendente${unread !== 1 ? 's' : ''} · ${read} no registro`}
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
              <CheckCheck size={14} /> Marcar todas
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="pendentes">
              Pendentes <span className="ml-2 text-xs text-muted-foreground">({unread})</span>
            </TabsTrigger>
            <TabsTrigger value="registro">
              Registro <span className="ml-2 text-xs text-muted-foreground">({read})</span>
            </TabsTrigger>
            <TabsTrigger value="todas">
              Todas <span className="ml-2 text-xs text-muted-foreground">({items.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Carregando...
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
                {filter === 'pendentes' && 'Tudo lido ✨'}
                {filter === 'registro' && 'Nenhuma no registro'}
                {filter === 'todas' && 'Nenhuma notificação'}
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
                            {EVENT_LABEL[n.evento] ?? n.evento}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border">
                            {n.origem}
                          </span>
                          {!n.lida && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
                              novo
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
                            {timeAgo(n.criadoEm)} {n.ator && `· por ${n.ator}`}
                          </span>
                          {n.lida ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkRead(n, false)}
                              className="h-7 text-[11px] gap-1"
                            >
                              <RotateCcw size={11} /> Pendente
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkRead(n, true)}
                              className="h-7 text-[11px] gap-1"
                            >
                              <Check size={11} /> Marcar lida
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

        <p className="text-[10px] text-center text-muted-foreground">
          Esta tela usa a API Express. Versão legacy em <code>/notificacoes</code>.
        </p>
      </div>
    </AppLayout>
  );
};

export default NotificacoesV2Page;
