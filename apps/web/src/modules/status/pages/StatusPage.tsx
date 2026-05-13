/**
 * /status — health check da API (master only).
 *
 * Mostra status do servidor Express + uptime + versão. Polling de 30s.
 * Útil pro master verificar se a API está no ar antes de testar as
 * telas v2.
 */
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, CheckCircle2, XCircle, Clock, GitCommit, RefreshCw, Loader2 } from 'lucide-react';
import { useApiHealth } from '@/modules/status';
import { Button } from '@/components/ui/button';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return `${h}h ${remM}min`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return `${d}d ${remH}h`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const StatusPage = () => {
  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useApiHealth();

  return (
    <AppLayout>
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Activity size={22} className="text-primary" /> Status da API
            </h1>
            <p className="text-sm text-muted-foreground">
              Health check do servidor Express (apps/api) · polling 30s
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Atualizar
          </Button>
        </div>

        {/* Status principal */}
        <Card>
          <CardContent className="p-5">
            {isLoading ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 size={20} className="animate-spin" />
                <span>Consultando /health...</span>
              </div>
            ) : error ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <XCircle size={32} className="text-destructive" />
                  <div>
                    <div className="font-semibold text-destructive">API offline</div>
                    <div className="text-sm text-muted-foreground">
                      {error.message || 'Não foi possível alcançar /health'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                  Pra subir a API local: <code>docker compose up -d</code> e
                  depois <code>npm run dev:api</code>.
                </div>
              </div>
            ) : data ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={32} className="text-success" />
                  <div>
                    <div className="font-semibold text-success text-lg">API online</div>
                    <div className="text-sm text-muted-foreground">
                      Status reportado: <code>{data.status}</code>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                  <Info
                    icon={<GitCommit size={14} />}
                    label="Versão"
                    value={data.version}
                  />
                  <Info
                    icon={<Clock size={14} />}
                    label="Iniciada em"
                    value={formatDateTime(data.startedAt)}
                  />
                  <Info
                    icon={<Activity size={14} />}
                    label="Uptime"
                    value={formatUptime(data.uptimeSeconds)}
                  />
                  <Info
                    icon={<RefreshCw size={14} />}
                    label="Última consulta"
                    value={dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt).toISOString()) : '—'}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground">
          Endpoint público: <code>GET /health</code>
        </p>
      </div>
    </AppLayout>
  );
};

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-xs">
      <div className="text-muted-foreground flex items-center gap-1 mb-0.5">
        {icon} {label}
      </div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}

export default StatusPage;
