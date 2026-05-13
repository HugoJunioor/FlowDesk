/**
 * ShortcutsHelpModal — lista os atalhos de teclado globais do FlowDesk.
 * Ativado via tecla "?" ou pelo link "Atalhos (?)" no footer do sidebar.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutsHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ['g', 'd'], description: 'Ir para Demandas' },
  { keys: ['g', 'k'], description: 'Ir para Demandas (visão Kanban)' },
  { keys: ['g', 'i'], description: 'Ir para o Dashboard' },
  { keys: ['g', 'n'], description: 'Ir para Notas' },
  { keys: ['g', 'c'], description: 'Ir para Configurações' },
  { keys: ['?'], description: 'Abrir / fechar este painel de atalhos' },
  { keys: ['Esc'], description: 'Fechar modal ou painel aberto' },
];

const ShortcutsHelpModal = ({ open, onOpenChange }: ShortcutsHelpModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Keyboard size={18} className="text-primary" />
          Atalhos de teclado
        </DialogTitle>
      </DialogHeader>

      <p className="text-xs text-muted-foreground -mt-1">
        Atalhos ignorados quando o foco estiver em campos de texto.
      </p>

      <div className="mt-2 space-y-1">
        {SHORTCUTS.map(({ keys, description }) => (
          <div key={keys.join('+')} className="flex items-center justify-between gap-4 py-1.5">
            <span className="text-sm text-foreground">{description}</span>
            <div className="flex items-center gap-1 shrink-0">
              {keys.map((k) => (
                <kbd
                  key={k}
                  className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded border border-border bg-muted text-xs font-mono text-foreground shadow-sm"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

export default ShortcutsHelpModal;
