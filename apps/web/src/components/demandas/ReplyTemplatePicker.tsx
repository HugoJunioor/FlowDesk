/**
 * Dropdown do composer que mostra templates salvos.
 * Click insere no textarea via onSelect.
 *
 * Mantenha em sync com /configuracoes (CRUD de templates).
 */
import { useState, useRef, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { listTemplates, type ReplyTemplate } from '@/lib/replyTemplates';

interface Props {
  onSelect: (template: ReplyTemplate) => void;
}

export default function ReplyTemplatePicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTemplates(listTemplates());
  }, [open]);

  // Click fora fecha
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Templates de resposta"
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText size={14} />
      </button>
      {open && (
        <div className="absolute z-20 left-0 top-full mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Templates de resposta
            </p>
          </div>
          {templates.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              Nenhum template salvo. Crie em Configurações → Templates.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <div className="text-xs font-medium">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {t.body}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-3 py-2 border-t border-border bg-muted/30">
            <a
              href="/configuracoes#templates"
              className="text-[11px] text-primary hover:underline"
            >
              Gerenciar templates →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
