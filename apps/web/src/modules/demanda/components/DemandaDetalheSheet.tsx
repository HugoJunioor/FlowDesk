/**
 * Sheet de detalhe da demanda — abre lateralmente com info completa
 * + lista de thread replies + form pra adicionar reply.
 */
import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, MessageCircle, ExternalLink, Database, Rocket } from 'lucide-react';
import {
  useThreadReplies, useAddReply,
  type Demanda,
} from '@/modules/demanda';
import { toApiError } from '@/lib/api/client';

interface DemandaDetalheSheetProps {
  demanda: Demanda | null;
  open: boolean;
  onClose: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const DemandaDetalheSheet = ({ demanda, open, onClose }: DemandaDetalheSheetProps) => {
  const [texto, setTexto] = useState('');
  const { data: replies, isLoading: loadingReplies } = useThreadReplies(
    open && demanda ? demanda.id : undefined,
  );
  const addReply = useAddReply(demanda?.id);

  const handleSend = async (): Promise<void> => {
    if (!texto.trim() || !demanda) return;
    try {
      await addReply.mutateAsync({ texto: texto.trim(), ehMembroEquipe: true });
      setTexto('');
    } catch {
      // erro mostrado abaixo
    }
  };

  if (!demanda) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{demanda.titulo}</SheetTitle>
          <SheetDescription className="text-xs flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              {demanda.prioridade.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {demanda.status}
            </Badge>
            <span className="text-muted-foreground">
              criada {formatDateTime(demanda.criadoEm)}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-sm">
          {demanda.descricao && (
            <p className="whitespace-pre-wrap">{demanda.descricao}</p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Origem" value={demanda.origem} />
            <Field label="Tipo" value={demanda.tipoDemanda ?? '—'} />
            <Field label="Solicitante" value={demanda.solicitanteNome ?? '—'} />
            <Field label="Responsável" value={demanda.responsavelNome ?? '—'} />
            {demanda.dueDate && (
              <Field label="Prazo" value={formatDateTime(demanda.dueDate)} />
            )}
            {demanda.concluidaEm && (
              <Field label="Concluída em" value={formatDateTime(demanda.concluidaEm)} />
            )}
          </div>

          {demanda.origem === 'internal' && demanda.infraKind && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1.5">
              <div className="font-medium flex items-center gap-1.5">
                {demanda.infraKind === 'deploy'
                  ? <><Rocket size={11} /> Deploy</>
                  : <><Database size={11} /> SQL</>}
              </div>
              {demanda.infraDatabase && (
                <div className="text-muted-foreground">Database: {demanda.infraDatabase}</div>
              )}
              {demanda.infraQuery && (
                <pre className="text-[10px] font-mono bg-background border rounded p-1.5 overflow-x-auto max-h-32">
                  {demanda.infraQuery}
                </pre>
              )}
              {demanda.infraExternalLink && (
                <a
                  href={demanda.infraExternalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-0.5"
                >
                  <ExternalLink size={10} /> Link externo
                </a>
              )}
            </div>
          )}

          {demanda.permalinkSlack && (
            <a
              href={demanda.permalinkSlack}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              <ExternalLink size={10} /> Abrir thread no Slack
            </a>
          )}
        </div>

        {/* Thread */}
        <div className="mt-6 border-t pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <MessageCircle size={14} /> Thread ({replies?.length ?? 0})
          </h3>

          {loadingReplies ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
              <Loader2 size={12} className="animate-spin mr-1.5" /> Carregando...
            </div>
          ) : !replies || replies.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Sem mensagens ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {replies.map((r) => (
                <li
                  key={r.id}
                  className={`text-xs p-2 rounded border ${
                    r.ehMembroEquipe
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <strong className={r.ehMembroEquipe ? 'text-primary' : ''}>
                      {r.autor}
                      {r.ehMembroEquipe && (
                        <span className="ml-1 text-[9px] text-primary/70">(equipe)</span>
                      )}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateTime(r.timestampMsg)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{r.texto}</p>
                </li>
              ))}
            </ul>
          )}

          {/* Add reply form */}
          <div className="space-y-2 border-t pt-3">
            <Textarea
              placeholder="Adicionar resposta..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              disabled={addReply.isPending}
            />
            {addReply.error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
                {toApiError(addReply.error).message}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => void handleSend()}
                disabled={!texto.trim() || addReply.isPending}
                className="gap-1.5"
              >
                {addReply.isPending
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Send size={12} />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}

export default DemandaDetalheSheet;
