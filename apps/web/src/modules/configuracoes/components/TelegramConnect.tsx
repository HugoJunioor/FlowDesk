/**
 * Painel de conexão Telegram — exibido em /configuracoes.
 *
 * Estados:
 *   - loading: consultando status
 *   - desconectado: mostra botão "Conectar Telegram"
 *   - aguardando: exibe o código gerado + instruções
 *   - conectado: mostra chat_id + botão "Desconectar" + toggle de notificações
 *   - desabilitado: backend retornou 503 (TELEGRAM_ENABLED=false)
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Loader2, Check, X, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api/client';
import { toApiError } from '@/lib/api/client';
import { unwrap } from '@/lib/api/response-mapper';
import { usePreferencia, useSavePreferencia } from '@/modules/notificacao';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TelegramStatus {
  connected: boolean;
  chatId?: string;
  connectedAt?: string;
}

interface LinkStartResponse {
  code: string;
  expiresAt: string;
  botUsername: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchStatus(): Promise<TelegramStatus> {
  const res = await apiClient.get('/telegram/status');
  return unwrap<TelegramStatus>(res);
}

async function startLink(): Promise<LinkStartResponse> {
  const res = await apiClient.post('/telegram/link/start', {});
  return unwrap<LinkStartResponse>(res);
}

async function cancelLink(): Promise<void> {
  await apiClient.post('/telegram/link/cancel', {});
}

async function disconnect(): Promise<void> {
  await apiClient.delete('/telegram/link');
}

// ── Componente ────────────────────────────────────────────────────────────────

const QK_STATUS = ['telegram', 'status'] as const;

export function TelegramConnect() {
  const qc = useQueryClient();
  const [linkInfo, setLinkInfo] = useState<LinkStartResponse | null>(null);

  const statusQuery = useQuery<TelegramStatus, Error>({
    queryKey: QK_STATUS,
    queryFn: fetchStatus,
    staleTime: 30_000,
    retry: false,
  });

  const startMutation = useMutation<LinkStartResponse, Error, void>({
    mutationFn: startLink,
    onSuccess: (data) => setLinkInfo(data),
  });

  const cancelMutation = useMutation<void, Error, void>({
    mutationFn: cancelLink,
    onSuccess: () => setLinkInfo(null),
  });

  const disconnectMutation = useMutation<void, Error, void>({
    mutationFn: disconnect,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK_STATUS });
    },
  });

  const { data: prefs } = usePreferencia();
  const savePrefsMutation = useSavePreferencia();

  // ── Handlers ──

  function handleToggleTelegram(checked: boolean): void {
    if (!prefs) return;
    void savePrefsMutation.mutateAsync({
      ...prefs,
      canais: { ...prefs.canais, telegram: checked },
    });
  }

  // ── Render helpers ──

  if (statusQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={14} className="animate-spin" /> Verificando status do Telegram...
        </CardContent>
      </Card>
    );
  }

  // Se o backend retornou 503 (TELEGRAM_ENABLED=false) ou outro erro de API
  if (statusQuery.error) {
    const apiErr = toApiError(statusQuery.error);
    if (apiErr.codigo === 'TELEGRAM_DESABILITADO' || apiErr.status === 503) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle size={16} className="text-muted-foreground" />
              <h2 className="font-semibold text-sm">Telegram</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Integração com Telegram não está habilitada neste servidor.
            </p>
          </CardContent>
        </Card>
      );
    }
  }

  const status = statusQuery.data;

  // ── Estado: conectado ──
  if (status?.connected) {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-primary" />
            <h2 className="font-semibold text-sm">Telegram</h2>
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Check size={12} /> Conectado
            </span>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Chat ID: <code className="bg-muted px-1 rounded">{status.chatId}</code></p>
            {status.connectedAt && (
              <p>Conectado em: {new Date(status.connectedAt).toLocaleString('pt-BR')}</p>
            )}
          </div>

          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm">Receber notificações por Telegram</div>
              <div className="text-[10px] text-muted-foreground">
                Notificações de demandas serão enviadas para o seu Telegram
              </div>
            </div>
            <Switch
              checked={prefs?.canais?.telegram ?? true}
              onCheckedChange={handleToggleTelegram}
              disabled={savePrefsMutation.isPending}
            />
          </label>

          {disconnectMutation.error && (
            <p className="text-xs text-destructive">
              {toApiError(disconnectMutation.error).message}
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => void disconnectMutation.mutateAsync()}
            disabled={disconnectMutation.isPending}
          >
            {disconnectMutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Unlink size={13} />
            )}
            Desconectar Telegram
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Estado: aguardando (code gerado, esperando /start) ──
  if (linkInfo) {
    const expiresAt = new Date(linkInfo.expiresAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-primary" />
            <h2 className="font-semibold text-sm">Telegram</h2>
            <span className="ml-auto text-xs text-amber-600 dark:text-amber-400">
              Aguardando confirmação...
            </span>
          </div>

          <div className="bg-muted rounded-md p-3 space-y-2">
            <p className="text-sm font-medium">Siga os passos:</p>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
              <li>
                Abra o Telegram e procure por{' '}
                <strong>@{linkInfo.botUsername}</strong>
              </li>
              <li>
                Envie a mensagem exatamente como abaixo:
              </li>
            </ol>
            <div className="bg-background border rounded px-3 py-2 font-mono text-sm select-all text-center">
              /start {linkInfo.code}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Expira às {expiresAt}. Após enviar, esta tela atualizará automaticamente.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 flex-1"
              onClick={() => void qc.invalidateQueries({ queryKey: QK_STATUS })}
            >
              <Check size={13} /> Já enviei
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => void cancelMutation.mutateAsync()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <X size={13} />
              )}
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Estado: desconectado ──
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-muted-foreground" />
          <h2 className="font-semibold text-sm">Telegram</h2>
        </div>

        <p className="text-xs text-muted-foreground">
          Receba notificações de demandas diretamente no Telegram. Conecte sua conta em segundos.
        </p>

        {startMutation.error && (
          <p className="text-xs text-destructive">
            {toApiError(startMutation.error).message}
          </p>
        )}

        <Button
          size="sm"
          className="gap-2"
          onClick={() => void startMutation.mutateAsync()}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Link2 size={13} />
          )}
          Conectar Telegram
        </Button>
      </CardContent>
    </Card>
  );
}
