/**
 * Composer pra responder uma demanda direto no Slack.
 *
 * Fase 1: layout + UI estatica (stub). O envio real vem na Fase 4
 * (depois do endpoint /slack/reply estar pronto na flowdesk-api).
 */
import { useState } from "react";
import { Bold, Italic, Code, Link2, Paperclip, Smile, Send, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SlackDemand } from "@/types/demand";

interface DemandReplyComposerProps {
  demand: SlackDemand;
  /** Callback quando user clica enviar (Fase 4 conecta na API). */
  onSend?: (text: string, attachments?: File[]) => Promise<void>;
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

const DemandReplyComposer = ({ demand, onSend }: DemandReplyComposerProps) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const apply = (before: string, after = before) => {
    setText((t) => t + before + after);
  };

  const handleSend = async () => {
    if (!text.trim() || !onSend) return;
    setSending(true);
    try {
      await onSend(text);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const disabled = !onSend; // Fase 1: nao tem onSend ainda → desabilita

  return (
    <div className="border-t bg-muted/30 px-4 py-3 shrink-0">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
        <Send size={12} className="text-primary" />
        Responder em <span className="font-medium text-foreground">{demand.slackChannel}</span>
        <span className="text-muted-foreground/60">· thread</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 mb-1.5 px-1">
        <ToolbarButton icon={Bold} label="Negrito (Ctrl+B)" onClick={() => apply("*")} />
        <ToolbarButton icon={Italic} label="Itálico (Ctrl+I)" onClick={() => apply("_")} />
        <ToolbarButton icon={Code} label="Código" onClick={() => apply("`")} />
        <ToolbarButton icon={Link2} label="Link" onClick={() => apply("<", "|texto>")} />
        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolbarButton icon={AtSign} label="Mencionar usuário" onClick={() => apply("@")} />
        <ToolbarButton icon={Smile} label="Emoji" onClick={() => apply(":", ":")} />
        <ToolbarButton icon={Paperclip} label="Anexar arquivo" />
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          disabled
            ? "Composer em construção (Fase 4 conecta no Slack)..."
            : "Digite sua resposta... use * negrito *, _ italico _, ` codigo `, @ mencao"
        }
        className="min-h-[80px] max-h-[200px] resize-y bg-background"
        disabled={disabled}
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-muted-foreground">
          {disabled ? (
            <span className="text-amber-600 dark:text-amber-400">⚠ Envio ainda não conectado — em desenvolvimento</span>
          ) : (
            <>Suporta formatação Slack (mrkdwn) · Ctrl+Enter envia</>
          )}
        </p>
        <Button
          size="sm"
          disabled={disabled || sending || !text.trim()}
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
