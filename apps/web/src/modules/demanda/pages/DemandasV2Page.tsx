/**
 * /demandas-v2 — lista de demandas consumindo /api/v1/demandas.
 *
 * Foco: lista paginada com filtros e ações rápidas (atender, concluir).
 * Kanban e drag-and-drop ficam pra evolução futura.
 */
import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Inbox, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock,
  Database, Rocket, MessageSquare, LoaderCircle,
} from 'lucide-react';
import {
  useDemandas, useAtenderDemanda, useConcluirDemanda,
  type Demanda, type DemandaQuery, type DemandPriority, type DemandStatus, type DemandOrigin,
} from '@/modules/demanda';
import DemandaDetalheSheet from '@/modules/demanda/components/DemandaDetalheSheet';
import { toApiError } from '@/lib/api/client';

const PRIORIDADE_LABEL: Record<DemandPriority, string> = {
  p1: 'P1', p2: 'P2', p3: 'P3', sem_classificacao: '—',
};

const PRIORIDADE_CLS: Record<DemandPriority, string> = {
  p1: 'bg-destructive/10 text-destructive border-destructive/30',
  p2: 'bg-warning/10 text-warning border-warning/30',
  p3: 'bg-info/10 text-info border-info/30',
  sem_classificacao: 'bg-muted text-muted-foreground border-border',
};

const STATUS_LABEL: Record<DemandStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  expirada: 'Expirada',
};

const STATUS_CLS: Record<DemandStatus, string> = {
  aberta: 'bg-warning/10 text-warning border-warning/30',
  em_andamento: 'bg-info/10 text-info border-info/30',
  concluida: 'bg-success/10 text-success border-success/30',
  expirada: 'bg-destructive/10 text-destructive border-destructive/30',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const DemandasV2Page = () => {
  const [query, setQuery] = useState<DemandaQuery>({ pagina: 1, limite: 50 });
  const [busca, setBusca] = useState('');
  const [selected, setSelected] = useState<Demanda | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useDemandas(query);
  const atender = useAtenderDemanda();
  const concluir = useConcluirDemanda();

  const applyBusca = (): void => {
    setQuery({ ...query, pagina: 1, busca: busca.trim() || undefined });
  };

  const setStatus = (status?: DemandStatus): void => {
    setQuery({ ...query, pagina: 1, status });
  };

  const setOrigem = (origem?: DemandOrigin): void => {
    setQuery({ ...query, pagina: 1, origem });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Inbox size={22} className="text-primary" /> Demandas (v2)
            </h1>
            <p className="text-sm text-muted-foreground">
              Via API REST · {data?.total ?? 0} demandas
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

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Buscar título ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyBusca()}
                className="h-8 text-sm flex-1 min-w-[200px] max-w-md"
              />
              <Button size="sm" onClick={applyBusca} className="h-8">Buscar</Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted-foreground">Status:</span>
              {(['aberta', 'em_andamento', 'concluida', 'expirada'] as DemandStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(query.status === s ? undefined : s)}
                  className={`px-2 py-1 rounded-full border transition-colors ${
                    query.status === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 hover:bg-muted border-border text-muted-foreground'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
              <span className="text-muted-foreground ml-3">Origem:</span>
              {(['slack', 'internal'] as DemandOrigin[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrigem(query.origem === o ? undefined : o)}
                  className={`px-2 py-1 rounded-full border transition-colors ${
                    query.origem === o
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 hover:bg-muted border-border text-muted-foreground'
                  }`}
                >
                  {o === 'slack' ? 'Slack' : 'Infra'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
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
        ) : !data || data.dados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma demanda encontrada.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.dados.map((d) => (
              <DemandaCard
                key={d.id}
                demanda={d}
                onAtender={() => void atender.mutateAsync(d.id)}
                onConcluir={() => void concluir.mutateAsync(d.id)}
                onClick={() => setSelected(d)}
                pendingAction={atender.isPending || concluir.isPending}
              />
            ))}

            {/* Paginacao */}
            {data.totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.pagina <= 1 || isFetching}
                  onClick={() => setQuery((q) => ({ ...q, pagina: Math.max(1, (q.pagina ?? 1) - 1) }))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {data.pagina} de {data.totalPaginas}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.pagina >= data.totalPaginas || isFetching}
                  onClick={() => setQuery((q) => ({ ...q, pagina: (q.pagina ?? 1) + 1 }))}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          Versão legacy em <code>/demandas</code>.
        </p>
      </div>

      <DemandaDetalheSheet
        demanda={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </AppLayout>
  );
};

interface DemandaCardProps {
  demanda: Demanda;
  onAtender: () => void;
  onConcluir: () => void;
  onClick: () => void;
  pendingAction: boolean;
}

function DemandaCard({ demanda, onAtender, onConcluir, onClick, pendingAction }: DemandaCardProps) {
  const overdue = demanda.dueDate
    && demanda.status !== 'concluida'
    && new Date(demanda.dueDate) < new Date();

  const StatusIcon = demanda.status === 'aberta' ? AlertCircle
    : demanda.status === 'em_andamento' ? LoaderCircle
    : demanda.status === 'concluida' ? CheckCircle2
    : Clock;

  return (
    <Card
      className="cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Badge variant="secondary" className={`text-[10px] border ${PRIORIDADE_CLS[demanda.prioridade]} shrink-0`}>
            {PRIORIDADE_LABEL[demanda.prioridade]}
          </Badge>
          <Badge variant="secondary" className={`text-[10px] border ${STATUS_CLS[demanda.status]} shrink-0 gap-1`}>
            <StatusIcon size={10} />
            {STATUS_LABEL[demanda.status]}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{demanda.titulo}</p>
            {demanda.descricao && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {demanda.descricao}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                {demanda.origem === 'slack' ? (
                  <><MessageSquare size={10} /> Slack</>
                ) : (
                  <>
                    {demanda.infraKind === 'deploy'
                      ? <Rocket size={10} />
                      : <Database size={10} />}
                    {demanda.infraKind === 'deploy' ? 'Deploy' : 'SQL'}
                  </>
                )}
              </span>
              {demanda.solicitanteNome && (
                <span>• por <strong className="text-foreground">{demanda.solicitanteNome}</strong></span>
              )}
              {demanda.responsavelNome && (
                <span>• resp <strong className="text-foreground">{demanda.responsavelNome}</strong></span>
              )}
              {demanda.dueDate && (
                <span className={overdue ? 'text-destructive font-medium' : ''}>
                  • prazo {formatDate(demanda.dueDate)}
                  {overdue && ' (vencido)'}
                </span>
              )}
              <span>• criada {formatDate(demanda.criadoEm)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {demanda.status === 'aberta' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onAtender(); }}
                disabled={pendingAction}
                className="h-7 text-xs"
              >
                Atender
              </Button>
            )}
            {demanda.status !== 'concluida' && demanda.status !== 'expirada' && (
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onConcluir(); }}
                disabled={pendingAction}
                className="h-7 text-xs"
              >
                Concluir
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DemandasV2Page;
