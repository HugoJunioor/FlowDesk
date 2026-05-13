/**
 * useKeyboardShortcuts — atalhos de teclado globais do FlowDesk.
 *
 * Sequencias "g X" aguardam ate 1.5s pela segunda tecla.
 * Atalhos sao ignorados quando o foco esta em input/textarea/contenteditable.
 *
 * Uso:
 *   const { helpOpen, setHelpOpen } = useKeyboardShortcuts();
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function isFocusedOnEditable(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  // Guarda a primeira tecla da sequencia "g X"
  const pendingG = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingG = useCallback(() => {
    pendingG.current = false;
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignora quando editando texto
      if (isFocusedOnEditable()) return;
      // Ignora modificadores (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key;

      // Esc — fecha modais. O Dialog do radix ja trata via onEscapeKeyDown,
      // mas garantimos via estado do helpOpen aqui.
      if (key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          e.preventDefault();
        }
        clearPendingG();
        return;
      }

      // Abre modal de ajuda
      if (key === '?') {
        e.preventDefault();
        clearPendingG();
        setHelpOpen((v) => !v);
        return;
      }

      // Inicia sequencia "g X"
      if (key === 'g' && !pendingG.current) {
        pendingG.current = true;
        // Limpa apos 1.5s se nao vier segunda tecla
        timeoutRef.current = setTimeout(() => {
          pendingG.current = false;
          timeoutRef.current = null;
        }, 1500);
        return;
      }

      // Segunda tecla da sequencia
      if (pendingG.current) {
        clearPendingG();
        e.preventDefault();
        switch (key) {
          case 'd':
          case 'k': // "go kanban" — mesma rota por agora
            navigate('/demandas');
            break;
          case 'i':
            navigate('/');
            break;
          case 'n':
            navigate('/notas');
            break;
          case 'c':
            navigate('/configuracoes');
            break;
          default:
            break;
        }
      }
    };

    // Evento customizado disparado pelo sidebar (link "Atalhos ?")
    const openHelpHandler = () => setHelpOpen(true);

    window.addEventListener('keydown', handler);
    window.addEventListener('shortcuts:open-help', openHelpHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('shortcuts:open-help', openHelpHandler);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [navigate, helpOpen, clearPendingG]);

  return { helpOpen, setHelpOpen };
}
