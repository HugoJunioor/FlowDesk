/**
 * /configuracoes-v2 — preferências de notificação consumindo a API.
 *
 * Reaproveita os hooks do modulo notificacao (usePreferencia +
 * useSavePreferencia). Form com toggles por evento + canais + SLA
 * thresholds.
 */
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Settings, Loader2, Save, Check, X } from 'lucide-react';
import {
  usePreferencia, useSavePreferencia,
  type NotificationEvent, type PreferenciaInput,
} from '@/modules/notificacao';
import { toApiError } from '@/lib/api/client';

const EVENT_LABELS: Record<NotificationEvent, string> = {
  demand_assigned: 'Demanda atribuída a você',
  demand_replied: 'Resposta nova em demanda sua',
  demand_started: 'Atendimento iniciado',
  demand_completed: 'Demanda concluída',
  demand_reopened: 'Demanda reaberta',
  demand_overdue: 'SLA estourado',
  demand_due_soon: 'SLA vencendo',
  demand_created: 'Nova demanda criada (time de Infra/SQL)',
};

const ALL_EVENTS: NotificationEvent[] = [
  'demand_assigned',
  'demand_replied',
  'demand_started',
  'demand_completed',
  'demand_reopened',
  'demand_overdue',
  'demand_due_soon',
  'demand_created',
];

const ConfiguracoesV2Page = () => {
  const { data: prefs, isLoading, error } = usePreferencia();
  const saveMutation = useSavePreferencia();
  const [localPrefs, setLocalPrefs] = useState<PreferenciaInput | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (prefs && !localPrefs) {
      setLocalPrefs({
        eventos: prefs.eventos ?? {},
        canais: prefs.canais ?? { inbox: true, browserPush: false, email: false },
        slaReminders: prefs.slaReminders ?? { p1Hours: 1, p2Hours: 2, p3Hours: 4 },
      });
    }
  }, [prefs, localPrefs]);

  const handleSave = async (): Promise<void> => {
    if (!localPrefs) return;
    try {
      await saveMutation.mutateAsync(localPrefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // erro mostrado abaixo
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 size={16} className="animate-spin mr-2" /> Carregando preferências...
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-12 text-center text-destructive text-sm">
            {toApiError(error).message}
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (!localPrefs) return null;

  return (
    <AppLayout>
      <div className="space-y-4 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings size={22} className="text-primary" /> Configurações (v2)
          </h1>
          <p className="text-sm text-muted-foreground">
            Preferências de notificação via API REST
          </p>
        </div>

        {/* Eventos */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">Eventos</h2>
            <p className="text-xs text-muted-foreground">
              Quais eventos geram notificação na sua inbox.
            </p>
            <div className="space-y-2">
              {ALL_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm">{EVENT_LABELS[ev]}</span>
                  <Switch
                    checked={localPrefs.eventos[ev] !== false}
                    onCheckedChange={(checked) =>
                      setLocalPrefs({
                        ...localPrefs,
                        eventos: { ...localPrefs.eventos, [ev]: checked },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Canais */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">Canais</h2>
            <p className="text-xs text-muted-foreground">
              Por onde receber as notificações.
            </p>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 py-1">
                <div>
                  <div className="text-sm">Inbox no Just Flow</div>
                  <div className="text-[10px] text-muted-foreground">Aparece no sino do sidebar</div>
                </div>
                <Switch
                  checked={localPrefs.canais.inbox}
                  onCheckedChange={(checked) =>
                    setLocalPrefs({
                      ...localPrefs,
                      canais: { ...localPrefs.canais, inbox: checked },
                    })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 py-1">
                <div>
                  <div className="text-sm">Push do navegador</div>
                  <div className="text-[10px] text-muted-foreground">Notification API nativa do browser</div>
                </div>
                <Switch
                  checked={localPrefs.canais.browserPush}
                  onCheckedChange={(checked) =>
                    setLocalPrefs({
                      ...localPrefs,
                      canais: { ...localPrefs.canais, browserPush: checked },
                    })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 py-1">
                <div>
                  <div className="text-sm">E-mail</div>
                  <div className="text-[10px] text-muted-foreground">Requer Resend configurado no servidor</div>
                </div>
                <Switch
                  checked={localPrefs.canais.email}
                  onCheckedChange={(checked) =>
                    setLocalPrefs({
                      ...localPrefs,
                      canais: { ...localPrefs.canais, email: checked },
                    })
                  }
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* SLA reminders */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">Lembretes de SLA</h2>
            <p className="text-xs text-muted-foreground">
              Quantas horas úteis antes do vencimento avisar (por prioridade).
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(['p1', 'p2', 'p3'] as const).map((p) => (
                <div key={p}>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {p.toUpperCase()} (h)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={72}
                    value={localPrefs.slaReminders[`${p}Hours`]}
                    onChange={(e) =>
                      setLocalPrefs({
                        ...localPrefs,
                        slaReminders: {
                          ...localPrefs.slaReminders,
                          [`${p}Hours`]: Number(e.target.value),
                        },
                      })
                    }
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Erro de save */}
        {saveMutation.error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 flex items-center gap-2">
            <X size={14} /> {toApiError(saveMutation.error).message}
          </div>
        )}

        {/* Save */}
        <div className="flex items-center justify-end gap-2">
          {saved && (
            <span className="text-xs text-success flex items-center gap-1">
              <Check size={12} /> Salvo
            </span>
          )}
          <Button
            onClick={() => void handleSave()}
            disabled={saveMutation.isPending}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Salvar preferências
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground">
          Esta tela usa a API Express. Versão legacy em <code>/configuracoes</code>.
        </p>
      </div>
    </AppLayout>
  );
};

export default ConfiguracoesV2Page;
