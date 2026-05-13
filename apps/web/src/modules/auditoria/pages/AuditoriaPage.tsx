/**
 * /auditoria — visualização da trilha de auditoria (master only).
 *
 * Consome GET /api/v1/auditoria (Fase pós-Just). Lista paginada com
 * filtros de recurso e ação. Cada entry expandivel mostra payload
 * antes/depois (já sanitizado server-side).
 */
import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ScrollText, Loader2, ChevronDown, ChevronUp, RefreshCw, Filter, X,
} from 'lucide-react';
import { useAuditoriaList, type AuditoriaQuery } from '@/modules/auditoria';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function acaoBadgeClass(acao: string): string {
  if (acao === 'login') return 'bg-success/10 text-success border-success/30';
  if (acao === 'logout') return 'bg-muted text-muted-foreground border-border';
  if (acao === 'change_password') return 'bg-warning/10 text-warning border-warning/30';
  if (acao === 'delete') return 'bg-destructive/10 text-destructive border-destructive/30';
  if (acao === 'create') return 'bg-info/10 text-info border-info/30';
  if (acao === 'update') return 'bg-primary/10 text-primary border-primary/30';
  return 'bg-muted text-muted-foreground border-border';
}

const AuditoriaPage = () => {
  const [query, setQuery] = useState<AuditoriaQuery>({ pagina: 1, limite: 50 });
  const [filtroRecurso, setFiltroRecurso] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useAuditoriaList(query);

  const applyFilters = (): void => {
    setQuery({
      pagina: 1,
      limite: 50,
      recurso: filtroRecurso.trim() || undefined,
      acao: filtroAcao.trim() || undefined,
    });
  };

  const clearFilters = (): void => {
    setFiltroRecurso('');
    setFiltroAcao('');
    setQuery({ pagina: 1, limite: 50 });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ScrollText size={22} className="text-primary" /> Auditoria
            </h1>
            <p className="text-sm text-muted-foreground">
              Trilha de operações (master only) · {data?.total ?? 0} registros
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
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-muted-foreground" />
              <Input
                placeholder="Recurso (auth, nota, demanda…)"
                value={filtroRecurso}
                onChange={(e) => setFiltroRecurso(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="h-8 text-sm w-48"
              />
              <Input
                placeholder="Ação (login, create, update…)"
                value={filtroAcao}
                onChange={(e) => setFiltroAcao(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="h-8 text-sm w-48"
              />
              <Button size="sm" onClick={applyFilters} className="h-8">
                Filtrar
              </Button>
              {(query.recurso || query.acao) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-8 gap-1 text-xs"
                >
                  <X size={12} /> Limpar
                </Button>
              )}
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
              {error.message}
            </CardContent>
          </Card>
        ) : !data || data.dados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhum registro encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {data.dados.map((entry) => {
              const expanded = expandedId === entry.id;
              return (
                <Card key={entry.id} className="overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-[10px] text-muted-foreground font-mono whitespace-nowrap pt-0.5 shrink-0">
                        {formatDateTime(entry.criadoEm)}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] border ${acaoBadgeClass(entry.acao)}`}
                      >
                        {entry.acao}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.recurso}
                      </Badge>
                      <div className="flex-1 text-xs text-muted-foreground truncate">
                        por <strong className="text-foreground">{entry.usuarioEmail ?? 'sistema'}</strong>
                        {entry.recursoId && (
                          <span className="ml-2 font-mono text-[10px] opacity-70">
                            {entry.recursoId.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 pt-1 border-t text-[11px] font-mono space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <div><strong className="text-foreground">IP:</strong> {entry.ip ?? '—'}</div>
                        <div><strong className="text-foreground">Request:</strong> {entry.requestId ?? '—'}</div>
                        <div className="col-span-2 truncate">
                          <strong className="text-foreground">User-Agent:</strong> {entry.userAgent ?? '—'}
                        </div>
                      </div>
                      {entry.payloadAntes != null && (
                        <details className="bg-muted/40 rounded p-2">
                          <summary className="cursor-pointer text-foreground">payload_antes</summary>
                          <pre className="mt-1 text-[10px] overflow-x-auto">
                            {JSON.stringify(entry.payloadAntes, null, 2)}
                          </pre>
                        </details>
                      )}
                      {entry.payloadDepois != null && (
                        <details className="bg-muted/40 rounded p-2">
                          <summary className="cursor-pointer text-foreground">payload_depois</summary>
                          <pre className="mt-1 text-[10px] overflow-x-auto">
                            {JSON.stringify(entry.payloadDepois, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Paginação */}
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
      </div>
    </AppLayout>
  );
};

export default AuditoriaPage;
