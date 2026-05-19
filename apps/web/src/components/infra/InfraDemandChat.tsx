/**
 * Chat interno de uma demanda interna.
 *
 * Lista mensagens com autor + timestamp + texto. Input no rodape
 * para enviar nova mensagem com opcao de anexar arquivo.
 * Separado do Slack — comunicacao interna entre solicitante e responsavel.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X, FileText, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import type { InfraChatMessage } from "@/types/demand";

interface InfraDemandChatProps {
  demandId: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 5;

interface PendingFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  addedAt: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const InfraDemandChat = ({ demandId }: InfraDemandChatProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<InfraChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await apiClient.infra.chatList(demandId);
      setMessages(res.messages || []);
    } catch {
      // silencioso — nao polui o chat com erros de rede
    } finally {
      setLoading(false);
    }
  }, [demandId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Scroll pro fim quando mensagens mudam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = async (list: FileList | null) => {
    if (!list) return;
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) {
      toast({ title: `Máximo ${MAX_FILES} arquivos`, variant: "destructive" });
      return;
    }
    for (const file of Array.from(list).slice(0, remaining)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name}: ${formatBytes(file.size)} (máx 25MB)`,
          variant: "destructive",
        });
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setFiles((prev) => [
          ...prev,
          {
            id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataUrl,
            addedAt: new Date().toISOString(),
          },
        ]);
      } catch {
        toast({ title: "Erro ao ler arquivo", description: file.name, variant: "destructive" });
      }
    }
  };

  const handleSend = async () => {
    const t = texto.trim();
    if (!t) return;
    const autor = currentUser?.name || currentUser?.login || "Anônimo";
    setSending(true);
    try {
      const res = await apiClient.infra.chatSend(demandId, {
        autor,
        texto: t,
        ...(files.length > 0 ? { files } : {}),
      });
      setMessages((prev) => [...prev, res.message]);
      setTexto("");
      setFiles([]);
    } catch (e) {
      toast({
        title: "Erro ao enviar mensagem",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 size={16} className="animate-spin mr-2" /> Carregando chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Lista de mensagens */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma mensagem ainda. Inicie a conversa abaixo.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{msg.autor}</span>
                <span className="text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="text-sm bg-muted/30 rounded px-3 py-2 whitespace-pre-wrap break-words">
                {msg.texto}
              </div>
              {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {msg.files.map((f) => (
                    <a
                      key={f.id}
                      href={f.dataUrl}
                      download={f.name}
                      className="flex items-center gap-1.5 text-[10px] px-2 py-1 bg-muted border rounded hover:bg-muted/70 transition-colors"
                      title={f.name}
                    >
                      <FileText size={10} />
                      <span className="truncate max-w-[120px]">{f.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Arquivos pendentes */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1.5 text-[10px] px-2 py-1 bg-primary/10 border border-primary/20 rounded"
            >
              <FileText size={10} />
              <span className="truncate max-w-[100px]">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem... (Ctrl+Enter para enviar)"
          rows={2}
          className="flex-1 resize-none text-sm"
          disabled={sending}
        />
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || files.length >= MAX_FILES}
            title="Anexar arquivo"
          >
            <Paperclip size={14} />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-8 w-8"
            onClick={() => void handleSend()}
            disabled={sending || !texto.trim()}
            title="Enviar (Ctrl+Enter)"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { void handleFileSelect(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
};

export default InfraDemandChat;
