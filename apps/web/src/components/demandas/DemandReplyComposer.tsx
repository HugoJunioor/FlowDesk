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
import { useRef, useState, useEffect, type KeyboardEvent, type DragEvent, type ChangeEvent } from "react";
import { Bold, Italic, Strikethrough, Code, Code2, Link2, Paperclip, Send, AtSign, X, FileText, Image as ImageIcon, List, ListOrdered, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiClient, ApiError, type SlackChannelMember } from "@/lib/apiClient";
import EmojiPicker from "./EmojiPicker";
import { useAuth } from "@/contexts/AuthContext";
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
  const { currentUser } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [channelMembers, setChannelMembers] = useState<SlackChannelMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  // Indica se o user logado tem token Slack OAuth — UI mostra discreto
  // entre toolbar e textarea pra deixar claro como sera postado
  const [slackConnected, setSlackConnected] = useState<boolean | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  // Captura cursor pos quando dropdown abre, pra usar no click (evita race com blur)
  const mentionCursorRef = useRef<number>(0);
  // Map nome -> slackId pra converter @Nome visual em <@ID> Slack na hora do envio.
  // Mantido como ref pra nao causar re-render. Persiste enquanto o composer estiver montado.
  const mentionMapRef = useRef<Map<string, string>>(new Map());

  // Atualiza posicao do dropdown quando rola/redimensiona (mantem ancorado ao textarea)
  useEffect(() => {
    if (!mentionAnchor) return;
    const updatePos = () => {
      const ta = textareaRef.current;
      if (!ta) return;
      const rect = ta.getBoundingClientRect();
      setMentionAnchor({ top: rect.bottom + 4, left: rect.left });
    };
    window.addEventListener("scroll", updatePos, true); // capture: pega scroll de qualquer ancestral
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [mentionAnchor !== null]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Busca membros reais do canal Slack pra autocomplete de @mention
  useEffect(() => {
    let cancelled = false;
    setMembersLoading(true);
    apiClient.slack.channelMembers(demand.slackChannel)
      .then((res) => { if (!cancelled) setChannelMembers(res.members); })
      .catch((err) => { console.warn("[composer] channel-members fetch falhou:", err); })
      .finally(() => { if (!cancelled) setMembersLoading(false); });
    return () => { cancelled = true; };
  }, [demand.slackChannel]);

  // Verifica se user tem Slack conectado — UI mostra indicador discreto
  useEffect(() => {
    if (!currentUser?.email) return;
    let cancelled = false;
    apiClient.auth.slackStatus(currentUser.email)
      .then((res) => { if (!cancelled) setSlackConnected(res.connected); })
      .catch(() => { if (!cancelled) setSlackConnected(false); });
    return () => { cancelled = true; };
  }, [currentUser?.email]);

  // Pessoas mencionaveis: MERGE dos membros do canal Slack + participantes
  // da thread (alguns que comentaram podem nao estar no canal). Dedup por nome.
  const mentionablePeople: Array<{ name: string; slackId?: string; email?: string; avatar?: string }> = (() => {
    const byName = new Map<string, { name: string; slackId?: string; email?: string; avatar?: string }>();
    // Primeiro adiciona thread participants (sem slack_id)
    const seen = new Set<string>();
    if (demand.assignee?.name) seen.add(demand.assignee.name);
    demand.cc?.forEach((c) => seen.add(c));
    demand.threadReplies?.forEach((r) => r.author && seen.add(r.author));
    if (demand.requester?.name) seen.add(demand.requester.name);
    Array.from(seen).forEach((n) => byName.set(n.toLowerCase(), { name: n }));
    // Depois sobrescreve com membros do canal (que tem slack_id)
    channelMembers.forEach((m) => {
      byName.set(m.name.toLowerCase(), {
        name: m.name,
        slackId: m.id,
        email: m.email,
        avatar: m.avatar,
      });
    });
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
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

  // Converte @Nome (visual) em <@SLACK_ID> (formato Slack) usando o mentionMap.
  // Ordena por tamanho desc pra evitar match parcial (ex: "Ana" antes de "Ana Maria").
  const expandMentions = (raw: string): string => {
    const entries = Array.from(mentionMapRef.current.entries())
      .sort((a, b) => b[0].length - a[0].length);
    let out = raw;
    for (const [name, id] of entries) {
      // Escapa metacaracteres regex no nome
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // \B@ pra permitir mention no inicio de uma palavra precedida por espaco/inicio,
      // e (?!\w) pra nao casar @AnaMaria quando o map so tem "Ana"
      const re = new RegExp(`@${escaped}(?!\\w)`, "g");
      out = out.replace(re, `<@${id}>`);
    }
    return out;
  };

  const handleSend = async () => {
    if ((!text.trim() && files.length === 0) || sending) return;
    setSending(true);
    try {
      let resultTs = "";
      const textToSend = expandMentions(text);

      if (files.length > 0) {
        const uploadResult = await apiClient.slack.upload({
          permalink: demand.slackPermalink,
          comment: textToSend.trim() || undefined,
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
          text: textToSend,
          senderEmail: currentUser?.email,
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
      console.group("[composer] send falhou — info de debug");
      console.error("Error:", err);
      console.log("Demand ID:", demand.id);
      console.log("Slack channel:", demand.slackChannel);
      console.log("Slack permalink:", demand.slackPermalink);
      console.log("Sender email:", currentUser?.email);
      console.log("Files:", files.length);
      console.log("Text length:", text.length);
      console.groupEnd();
    } finally {
      setSending(false);
    }
  };

  // Funcao pra selecionar pessoa no mention dropdown (compartilhada click + teclado)
  const selectMentionPerson = (person: { name: string; slackId?: string }) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = mentionCursorRef.current;
    const before = text.slice(0, cursor);
    // Sempre insere @Nome visualmente. Se tiver slackId, registra no map
    // pra converter pra <@ID> na hora de enviar pro Slack.
    if (person.slackId) {
      mentionMapRef.current.set(person.name, person.slackId);
    }
    const replacement = `@${person.name} `;
    const newBefore = before.replace(/@\w*$/, replacement);
    const newText = newBefore + text.slice(cursor);
    setText(newText);
    setMentionFilter(null);
    setMentionAnchor(null);
    setMentionSelectedIdx(0);
    setTimeout(() => {
      ta.focus();
      const newPos = newBefore.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Navegacao no mention dropdown se aberto
    if (mentionFilter !== null) {
      const filtered = mentionablePeople.filter((p) =>
        p.name.toLowerCase().includes(mentionFilter.toLowerCase())
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionSelectedIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        const chosen = filtered[Math.min(mentionSelectedIdx, filtered.length - 1)];
        selectMentionPerson(chosen);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionFilter(null);
        setMentionAnchor(null);
        return;
      }
    }

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
      {dragOver && (
        <div className="text-xs text-primary font-medium animate-pulse mb-2 text-center">
          Solte os arquivos aqui
        </div>
      )}

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

      {/* Indicador discreto: posta como user real (OAuth) ou como bot JustFlow.
          Click vai pro perfil pra conectar — link gentil, nao bloqueia. */}
      {slackConnected !== null && (
        <div className="flex items-center justify-end gap-1.5 mb-1 px-1 text-[10px]">
          {slackConnected ? (
            <span className="text-success/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Postando com sua identidade Slack
            </span>
          ) : (
            <a
              href="/perfil"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              title="Conecte sua conta Slack pra postar com sua identidade real"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
              Postando como JustFlow · conectar →
            </a>
          )}
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            const ta = e.target;
            const cursor = ta.selectionStart;
            const before = v.slice(0, cursor);
            const m = before.match(/@(\w*)$/);
            if (m) {
              setMentionFilter(m[1]);
              setMentionSelectedIdx(0); // reset selecao a cada novo filtro
              mentionCursorRef.current = cursor;
              const rect = ta.getBoundingClientRect();
              setMentionAnchor({
                top: rect.bottom + 4,
                left: rect.left,
              });
            } else {
              setMentionFilter(null);
              setMentionAnchor(null);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder=""
          className="min-h-[120px] max-h-[260px] resize-y bg-background pr-14"
        />

        {/* Botao enviar dentro do textarea, canto inferior direito */}
        <Button
          size="icon"
          disabled={!canSend}
          onClick={handleSend}
          className="absolute bottom-2 right-2 h-9 w-9 rounded-full shadow-md"
          title="Enviar (Ctrl+Enter)"
          aria-label="Enviar"
        >
          {sending ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </Button>

        {/* Mention dropdown */}
      </div>

      {/* Mention dropdown — RENDERIZADO DENTRO DO DIALOG (sem portal).
          position: fixed escapa overflow:hidden do DialogContent SEM tirar
          o elemento da arvore do Radix Dialog — portanto Radix nao trata
          clicks aqui como "outside" e o modal nao fecha. */}
      {mentionFilter !== null && mentionAnchor && (() => {
          const filtered = mentionablePeople.filter((p) =>
            p.name.toLowerCase().includes(mentionFilter.toLowerCase())
          );
          return (
            <div
              data-mention-dropdown
              className="fixed z-[9999] bg-popover border rounded-lg shadow-2xl max-h-72 overflow-y-auto min-w-[280px] max-w-[400px]"
              style={{ top: mentionAnchor.top, left: mentionAnchor.left }}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-3 py-1.5 border-b flex items-center gap-1.5 sticky top-0 bg-popover">
                <AtSign size={10} /> Mencionar
                {membersLoading ? (
                  <span className="ml-auto opacity-70 normal-case">buscando...</span>
                ) : channelMembers.length > 0 ? (
                  <span className="ml-auto opacity-70 normal-case">{channelMembers.length} no canal</span>
                ) : (
                  <span className="ml-auto opacity-70 normal-case">só thread</span>
                )}
              </div>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                  {membersLoading ? "Carregando membros..." : `Nenhum match com "${mentionFilter}"`}
                </div>
              ) : filtered.slice(0, 12).map((person, idx) => {
                const isSelected = idx === Math.min(mentionSelectedIdx, filtered.length - 1);
                return (
                <button
                  key={person.slackId || person.name}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 cursor-pointer ${
                    isSelected ? "bg-primary/10 text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onMouseEnter={() => setMentionSelectedIdx(idx)}
                  // preventDefault no mouseDown evita textarea perder foco;
                  // selecao acontece no click normal — Radix Dialog nao fecha mais
                  // porque o dropdown esta DENTRO da arvore do Dialog (sem portal).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectMentionPerson(person)}
                >
                  {person.avatar ? (
                    <img src={person.avatar} alt="" className="w-6 h-6 rounded-full shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{person.name}</div>
                    {person.email && (
                      <div className="text-[10px] text-muted-foreground truncate">{person.email}</div>
                    )}
                  </div>
                  {person.slackId && (
                    <span className="text-[10px] text-success" title="Mention real (notifica)">●</span>
                  )}
                </button>
                );
              })}
            </div>
          );
        })()}

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

      {files.length > 0 && (
        <p className="text-[10px] text-primary font-medium mt-1.5 text-right">
          {files.length} anexo{files.length > 1 ? "s" : ""} pronto{files.length > 1 ? "s" : ""} pra envio
        </p>
      )}
    </div>
  );
};

export default DemandReplyComposer;
