/**
 * Composer pra responder uma demanda direto no Slack.
 *
 * Fase 3+4: formatacao inteligente (envolve selecao), Ctrl+Enter envia,
 * conectado em POST /slack/reply via apiClient.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { Bold, Italic, Code, Link2, Paperclip, Smile, Send, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { SlackDemand } from "@/types/demand";

interface DemandReplyComposerProps {
  demand: SlackDemand;
  /** Callback opcional após envio bem-sucedido (atualizar thread no front). */
  onReplied?: (text: string, ts: string) => void;
}

const ToolbarButton = ({
  icon: Icon, label, onClick,
}: { icon: typeof Bold; label: string; onClick?: () => void }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-7 w-7 p-0"
    title={label}
    aria-label={label}
    onClick={onClick}
  >
    <Icon size={14} />
  </Button>
);

const DemandReplyComposer = ({ demand, onReplied }: DemandReplyComposerProps) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Envolve a selecao com os marcadores antes/depois (ou insere os marcadores
   * vazios se nao tem selecao). Re-foca no fim da insercao.
   */
  const wrapSelection = (before: string, after = before) => {
    const ta = textareaRef.current;
    if (!ta) {
      setText((t) => t + before + after);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + before + selected + after + text.slice(end);
    setText(newText);
    // Re-foca apos render (defer com setTimeout)
    setTimeout(() => {
      ta.focus();
      const cursorPos = selected
        ? start + before.length + selected.length + after.length
        : start + before.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const result = await apiClient.slack.reply({
        permalink: demand.slackPermalink,
        text,
      });
      toast.success("Resposta enviada", {
        description: result.permalink
          ? "Mensagem postada no Slack com sucesso"
          : "Mensagem postada (sem link de retorno)",
      });
      onReplied?.(text, result.ts);
      setText("");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Erro desconhecido";
      toast.error("Falha ao enviar", { description: msg });
      console.error("[composer] send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter ou Cmd+Enter envia
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
      return;
    }
    // Atalhos de formatacao
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") {
        e.preventDefault();
        wrapSelection("*");
      } else if (e.key === "i") {
        e.preventDefault();
        wrapSelection("_");
      } else if (e.key === "e") {
        e.preventDefault();
        wrapSelection("`");
      }
    }
  };

  return (
    <div className="border-t bg-muted/30 px-4 py-3 shrink-0">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
        <Send size={12} className="text-primary" />
        Responder em <span className="font-medium text-foreground">{demand.slackChannel}</span>
        <span className="text-muted-foreground/60">· thread</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 mb-1.5 px-1">
        <ToolbarButton icon={Bold} label="Negrito (Ctrl+B)" onClick={() => wrapSelection("*")} />
        <ToolbarButton icon={Italic} label="Itálico (Ctrl+I)" onClick={() => wrapSelection("_")} />
        <ToolbarButton icon={Code} label="Código (Ctrl+E)" onClick={() => wrapSelection("`")} />
        <ToolbarButton icon={Link2} label="Link" onClick={() => wrapSelection("<", "|texto>")} />
        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolbarButton icon={AtSign} label="Mencionar usuário" onClick={() => wrapSelection("<@", ">")} />
        <ToolbarButton icon={Smile} label="Emoji" onClick={() => wrapSelection(":", ":")} />
        <ToolbarButton icon={Paperclip} label="Anexar arquivo (em breve)" />
      </div>

      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Digite sua resposta... use *negrito*, _italico_, `codigo`. Ctrl+Enter envia."
        className="min-h-[80px] max-h-[200px] resize-y bg-background"
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-muted-foreground">
          Suporta <span className="font-mono">*bold*</span>{" · "}
          <span className="font-mono">_italic_</span>{" · "}
          <span className="font-mono">`code`</span>{" · "}
          <span className="font-mono">{`<url|texto>`}</span>
          {" · "}<kbd className="px-1 rounded bg-background border text-[9px]">Ctrl+Enter</kbd> envia
        </p>
        <Button
          size="sm"
          disabled={sending || !text.trim()}
          onClick={handleSend}
          className="gap-1.5 h-8"
        >
          {sending ? (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={12} />
          )}
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
};

export default DemandReplyComposer;
