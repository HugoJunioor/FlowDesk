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
  ScrollText, Loader2, ChevronDown, ChevronUp, RefreshCw, Filter, X, Download,
} from 'lucide-react';
import { useAuditoriaList, auditoriaApi, type AuditoriaQuery, type AuditoriaEntry } from '@/modules/auditoria';
import { diffObjects, formatDiffValue, type DiffEntry } from '@/modules/auditoria/utils/diffObjects';

/** Converte string pra formato seguro de CSV: escapa aspas + envolve com aspas. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  // Sempre envolve com aspas; escape de aspas duplicando-as
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(entries: AuditoriaEntry[]): string {
  const header = [
    'criado_em', 'usuario_email', 'recurso', 'recurso_id', 'acao',
    'ip', 'user_agent', 'request_id', 'payload_antes', 'payload_depois',
  ].join(',');
  const rows = entries.map((e) => [
    csvCell(e.criadoEm),
    csvCell(e.usuarioEmail ?? ''),
    csvCell(e.recurso),
    csvCell(e.recursoId ?? ''),
    csvCell(e.acao),
    csvCell(e.ip ?? ''),
    csvCell(e.userAgent ?? ''),
    csvCell(e.requestId ?? ''),
    csvCell(e.payloadAntes),
    csvCell(e.payloadDepois),
  ].join(','));
  return [header, ...rows].join('\n');
}

function downloadCsv(content: string, filename: string): void {
  // BOM UTF-8 pra Excel abrir com acentuacao correta
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

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

// --- Diff visual ---

function diffEntryColor(op: DiffEntry['op']): string {
  if (op === 'add') return 'text-success';
  if (op === 'remove') return 'text-destructive';
  return 'text-foreground';
}

function diffEntryPrefix(op: DiffEntry['op']): string {
  if (op === 'add') return '+';
  if (op === 'remove') return '-';
  return '~';
}

interface PayloadDiffProps {
  before: unknown;
  after: unknown;
}

const PayloadDiff = ({ before, after }: PayloadDiffProps) => {
  const [showRaw, setShowRaw] = useState(false);
  const diffs = diffObjects(before, after);

  return (
    <div className="bg-muted/40 rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-foreground font-semibold">Alteracoes</span>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-[9px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {showRaw ? 'Ver diff' : 'Ver JSON bruto'}
        </button>
      </div>

      {showRaw ? (
        <div className="grid grid-cols-2 gap-2">
          {before != null && (
            <div>
              <div className="text-[9px] text-muted-foreground mb-0.5">antes</div>
              <pre className="text-[10px] overflow-x-auto">{JSON.stringify(before, null, 2)}</pre>
            </div>
          )}
          {after != null && (
            <div>
              <div className="text-[9px] text-muted-foreground mb-0.5">depois</div>
              <pre className="text-[10px] overflow-x-auto">{JSON.stringify(after, null, 2)}</pre>
            </div>
          )}
        </div>
      ) : diffs.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">Sem alteracoes detectadas.</p>
      ) : (
        <div className="space-y-0.5">
          {diffs.map((d) => (
            <div key={d.key} className={`flex items-baseline gap-1.5 ${diffEntryColor(d.op)}`}>
              <span className="shrink-0 w-3 text-center select-none opacity-60">
                {diffEntryPrefix(d.op)}
              </span>
              <span className="font-semibold shrink-0">{d.key}:</span>
              {d.op === 'change' && (
                <>
                  <span className="line-through text-muted-foreground">
                    {formatDiffValue(d.before)}
                  </span>
                  <span className="text-muted-foreground mx-0.5">→</span>
                  <span>{formatDiffValue(d.after)}</span>
                </>
              )}
              {d.op === 'add' && (
                <span>
                  {formatDiffValue(d.after)}
                  {' '}
                  <span className="opacity-50">(novo)</span>
                </span>
              )}
              {d.op === 'remove' && (
                <span className="line-through opacity-60">
                  {formatDiffValue(d.before)}
                  {' '}
                  <span className="opacity-50 no-underline">(removido)</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AuditoriaPage = () => {
  const [query, setQuery] = useState<AuditoriaQuery>({ pagina: 1, limite: 50 });
  const [filtroRecurso, setFiltroRecurso] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useAuditoriaList(query);

  const handleExportCsv = async (): Promise<void> => {
    setExporting(true);
    try {
      // Pega ate 5000 registros respeitando os filtros atuais
      const allBatches: AuditoriaEntry[] = [];
      let pagina = 1;
      while (pagina <= 50) { // cap de 50 paginas * 100 = 5000 registros
        const batch = await auditoriaApi.list({
          ...query,
          pagina,
          limite: 100,
        });
        allBatches.push(...batch.dados);
        if (batch.dados.length < 100 || pagina >= batch.totalPaginas) break;
        pagina++;
      }
      const csv = toCsv(allBatches);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadCsv(csv, `flowdesk-auditoria-${stamp}.csv`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('export csv falhou', err);
    } finally {
      setExporting(false);
    }
  };

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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleExportCsv()}
              disabled={exporting || !data || data.dados.length === 0}
              className="gap-2"
              title="Exporta ate 5000 registros respeitando os filtros atuais"
            >
              {exporting
                ? <Loader2 size={14} className="animate-spin" />
                : <Download size={14} />}
              Exportar CSV
            </Button>
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
                    type="button"
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
                      {(entry.payloadAntes != null || entry.payloadDepois != null) && (
                        <PayloadDiff
                          before={entry.payloadAntes}
                          after={entry.payloadDepois}
                        />
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
