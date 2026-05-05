/**
 * Composer pra responder uma demanda direto no Slack — com anexos.
 *
 * Fases 3+4+5+6:
 * - Formatacao Slack mrkdwn (selection-aware)
 * - Atalhos: Ctrl+B/I/E + Ctrl+Enter
 * - Upload de arquivo via /slack/upload (multipart)
 * - Drag-and-drop de arquivos sobre o composer
 * - Optimistic update do thread (callback onReplied/onUploaded)
 */
import { useRef, useState, type KeyboardEvent, type DragEvent, type ChangeEvent } from "react";
import { Bold, Italic, Strikethrough, Code, Code2, Link2, Paperclip, Send, AtSign, X, FileText, Image as ImageIcon, List, ListOrdered, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/apiClient";
import EmojiPicker from "./EmojiPicker";
import type { SlackDemand } from "@/types/demand";

interface DemandReplyComposerProps {
  demand: SlackDemand;
  /** Callback após envio bem-sucedido (atualizar thread localmente). */
  onReplied?: (text: string, ts: string) => void;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

const ToolbarButton = ({
  icon: Icon, label, onClick, disabled,
}: { icon: typeof Bold; label: string; onClick?: () => void; disabled?: boolean }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-7 w-7 p-0"
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
  >
    <Icon size={14} />
  </Button>
);

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const DemandReplyComposer = ({ demand, onReplied }: DemandReplyComposerProps) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pessoas que ja apareceram nessa thread (pra autocomplete de @mention)
  const mentionablePeople = (() => {
    const set = new Set<string>();
    if (demand.assignee?.name) set.add(demand.assignee.name);
    demand.cc?.forEach((c) => set.add(c));
    demand.threadReplies?.forEach((r) => r.author && set.add(r.author));
    if (demand.requester?.name) set.add(demand.requester.name);
    return Array.from(set).sort();
  })();

  // Estado do dropdown de mention
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);

  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setText((t) => t + snippet);
      return;
    }
    const pos = ta.selectionStart;
    const newText = text.slice(0, pos) + snippet + text.slice(pos);
    setText(newText);
    setTimeout(() => {
      ta.focus();
      const cursorPos = pos + snippet.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  /**
   * Aplica prefixo a cada linha da selecao (ou linha atual se sem selecao).
   * Usado pra listas e quotes em mrkdwn Slack.
   */
  const prefixLines = (prefix: string | ((idx: number) => string)) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // Expande a selecao pra cobrir linhas inteiras
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = text.indexOf("\n", end);
    const realEnd = lineEnd === -1 ? text.length : lineEnd;

    const segment = text.slice(lineStart, realEnd);
    const lines = segment.split("\n");
    const prefixed = lines
      .map((line, i) => (typeof prefix === "function" ? prefix(i) : prefix) + line)
      .join("\n");
    const newText = text.slice(0, lineStart) + prefixed + text.slice(realEnd);
    setText(newText);
    setTimeout(() => {
      ta.focus();
      const cursorPos = lineStart + prefixed.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  /** Wrap multi-linha pra code block (3 backticks). */
  const wrapBlock = (delim: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    // Garante newlines antes/depois pra code block ficar bonito
    const before = (start === 0 || text[start - 1] === "\n") ? "" : "\n";
    const after = (end === text.length || text[end] === "\n") ? "" : "\n";
    const wrapped = `${before}${delim}\n${selected || ""}\n${delim}${after}`;
    const newText = text.slice(0, start) + wrapped + text.slice(end);
    setText(newText);
    setTimeout(() => {
      ta.focus();
      const cursorPos = start + before.length + delim.length + 1 + (selected.length || 0);
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

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
    setTimeout(() => {
      ta.focus();
      const cursorPos = selected
        ? start + before.length + selected.length + after.length
        : start + before.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const addFiles = (newFiles: File[]) => {
    const valid: File[] = [];
    for (const f of newFiles) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error("Arquivo muito grande", {
          description: `${f.name}: ${formatBytes(f.size)} excede 25MB`,
        });
        continue;
      }
      valid.push(f);
    }
    if (files.length + valid.length > 5) {
      toast.error("Máximo 5 arquivos por mensagem");
      return;
    }
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(Array.from(e.target.files));
    e.target.value = ""; // permite selecionar o mesmo arquivo de novo
  };

  const handleSend = async () => {
    if ((!text.trim() && files.length === 0) || sending) return;
    setSending(true);
    try {
      let resultTs = "";

      if (files.length > 0) {
        const uploadResult = await apiClient.slack.upload({
          permalink: demand.slackPermalink,
          comment: text.trim() || undefined,
          files,
        });
        resultTs = `upload-${Date.now()}`;
        toast.success(
          files.length === 1 ? "Arquivo enviado" : `${files.length} arquivos enviados`,
          { description: text.trim() ? "Com mensagem inicial" : "Sem comentário" }
        );
      } else {
        const reply = await apiClient.slack.reply({
          permalink: demand.slackPermalink,
          text,
        });
        resultTs = reply.ts;
        toast.success("Resposta enviada", {
          description: "Mensagem postada no Slack",
        });
      }

      onReplied?.(text, resultTs);
      setText("");
      setFiles([]);
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
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") { e.preventDefault(); wrapSelection("*"); }
      else if (e.key === "i") { e.preventDefault(); wrapSelection("_"); }
      else if (e.key === "e") { e.preventDefault(); wrapSelection("`"); }
    }
  };

  const canSend = (text.trim().length > 0 || files.length > 0) && !sending;

  return (
    <div
      className={`bg-muted/30 px-4 py-3 transition-colors ${
        dragOver ? "bg-primary/10 ring-2 ring-primary/40 ring-inset" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
        <Send size={12} className="text-primary" />
        Responder em <span className="font-medium text-foreground">{demand.slackChannel}</span>
        <span className="text-muted-foreground/60">· thread</span>
        {dragOver && (
          <span className="ml-auto text-primary font-medium animate-pulse">Solte os arquivos aqui</span>
        )}
      </div>

      {/* Toolbar — paridade com Slack mrkdwn */}
      <div className="flex items-center gap-0.5 mb-1.5 px-1 flex-wrap">
        {/* Formatacao inline */}
        <ToolbarButton icon={Bold} label="Negrito (Ctrl+B)" onClick={() => wrapSelection("*")} />
        <ToolbarButton icon={Italic} label="Itálico (Ctrl+I)" onClick={() => wrapSelection("_")} />
        <ToolbarButton icon={Strikethrough} label="Tachado" onClick={() => wrapSelection("~")} />
        <ToolbarButton icon={Code} label="Código inline (Ctrl+E)" onClick={() => wrapSelection("`")} />
        <div className="w-px h-4 bg-border mx-0.5" />
        {/* Estrutura — listas, quote, code block */}
        <ToolbarButton
          icon={List}
          label="Lista"
          onClick={() => prefixLines("• ")}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Lista numerada"
          onClick={() => prefixLines((i) => `${i + 1}. `)}
        />
        <ToolbarButton
          icon={Quote}
          label="Citação"
          onClick={() => prefixLines("> ")}
        />
        <ToolbarButton
          icon={Code2}
          label="Bloco de código"
          onClick={() => wrapBlock("```")}
        />
        <ToolbarButton icon={Link2} label="Link" onClick={() => wrapSelection("<", "|texto>")} />
        <div className="w-px h-4 bg-border mx-0.5" />
        {/* Inserts */}
        <ToolbarButton icon={AtSign} label="Mencionar" onClick={() => insertAtCursor("@")} />
        <EmojiPicker onSelect={(name) => insertAtCursor(`:${name}: `)} />
        <ToolbarButton
          icon={Paperclip}
          label="Anexar arquivo"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            // Detecta @ pra abrir mention dropdown
            const ta = e.target;
            const cursor = ta.selectionStart;
            const before = v.slice(0, cursor);
            const m = before.match(/@(\w*)$/);
            setMentionFilter(m ? m[1] : null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua resposta... use *negrito*, _italico_, `codigo`. @ menciona. Ctrl+Enter envia."
          className="min-h-[80px] max-h-[200px] resize-y bg-background"
        />

        {/* Mention dropdown */}
        {mentionFilter !== null && (
          (() => {
            const filtered = mentionablePeople.filter((p) =>
              p.toLowerCase().includes(mentionFilter.toLowerCase())
            );
            if (filtered.length === 0) return null;
            return (
              <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto min-w-[200px]">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 border-b">
                  Mencionar
                </div>
                {filtered.slice(0, 8).map((person) => (
                  <button
                    key={person}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-1.5"
                    onClick={() => {
                      // Substitui @parcial por @nome completo
                      const ta = textareaRef.current;
                      if (!ta) return;
                      const cursor = ta.selectionStart;
                      const before = text.slice(0, cursor);
                      const newBefore = before.replace(/@\w*$/, `@${person} `);
                      const newText = newBefore + text.slice(cursor);
                      setText(newText);
                      setMentionFilter(null);
                      setTimeout(() => {
                        ta.focus();
                        const newPos = newBefore.length;
                        ta.setSelectionRange(newPos, newPos);
                      }, 0);
                    }}
                  >
                    <AtSign size={11} className="text-muted-foreground" />
                    {person}
                  </button>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* Lista de anexos */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-background border rounded-md px-2 py-1 text-xs"
            >
              {f.type.startsWith("image/") ? (
                <ImageIcon size={12} className="text-primary shrink-0" />
              ) : (
                <FileText size={12} className="text-muted-foreground shrink-0" />
              )}
              <span className="truncate max-w-[180px]" title={f.name}>{f.name}</span>
              <span className="text-muted-foreground text-[10px]">{formatBytes(f.size)}</span>
              <button
                type="button"
                className="ml-0.5 opacity-50 hover:opacity-100"
                onClick={() => removeFile(i)}
                aria-label="Remover"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-mono">*B*</span>{" · "}
          <span className="font-mono">_I_</span>{" · "}
          <span className="font-mono">~S~</span>{" · "}
          <span className="font-mono">`code`</span>{" · "}
          <span className="font-mono">{"> quote"}</span>{" · "}
          <kbd className="px-1 rounded bg-background border text-[9px]">Ctrl+Enter</kbd>
          {files.length > 0 && (
            <span className="ml-2 text-primary font-medium">
              {files.length} anexo{files.length > 1 ? "s" : ""}
            </span>
          )}
        </p>
        <Button size="sm" disabled={!canSend} onClick={handleSend} className="gap-1.5 h-8">
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
