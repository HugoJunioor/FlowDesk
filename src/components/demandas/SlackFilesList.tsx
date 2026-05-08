/**
 * Renderiza arquivos anexados a uma mensagem Slack.
 *
 * Visual:
 * - Imagens (mimetype image/*): thumb pequeno; click abre tamanho real.
 *   Se thumb falha carregar (URL privada do Slack sem proxy backend
 *   configurado), renderiza como chip generico, mantendo proporcao
 *   visual com outros arquivos.
 * - Outros (PDF, video, doc, zip): chip compacto com icone + nome
 *   + tamanho + botao baixar.
 */
import { useState } from "react";
import { Download, FileText, Image as ImageIcon, FileVideo, FileArchive, File } from "lucide-react";
import type { SlackFile } from "@/types/demand";

interface SlackFilesListProps {
  files: SlackFile[];
  /** Tamanho compacto (pra dentro de thread reply) */
  compact?: boolean;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function iconForMime(mimetype: string) {
  if (mimetype.startsWith("image/")) return ImageIcon;
  if (mimetype.startsWith("video/")) return FileVideo;
  if (mimetype.includes("zip") || mimetype.includes("tar")) return FileArchive;
  if (mimetype.includes("pdf") || mimetype.includes("doc") || mimetype.includes("text")) return FileText;
  return File;
}

/** URL pra baixar o arquivo. Usa proxy local /slack/file/:id; arquivos
 *  publicos podem ser baixados direto do Slack. */
function downloadUrl(file: SlackFile): string {
  if (file.isPublic && file.urlPrivate) return file.urlPrivate;
  const apiBase = import.meta.env.VITE_FLOWDESK_API_URL ?? "";
  return `${apiBase}/slack/file/${encodeURIComponent(file.id)}`;
}

const FileChip = ({ file, compact }: { file: SlackFile; compact?: boolean }) => {
  const Icon = iconForMime(file.mimetype);
  return (
    <a
      href={downloadUrl(file)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 bg-muted/50 hover:bg-muted border border-border rounded-md transition-colors ${
        compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1.5 text-xs"
      }`}
      title={`${file.name} (${formatBytes(file.size)})`}
    >
      <Icon size={compact ? 12 : 13} className="text-primary shrink-0" />
      <span className={`truncate ${compact ? "max-w-[140px]" : "max-w-[200px]"}`}>{file.name}</span>
      <span className="text-muted-foreground text-[10px]">{formatBytes(file.size)}</span>
      <Download size={compact ? 10 : 11} className="opacity-50 shrink-0" />
    </a>
  );
};

const ImageThumb = ({ file, compact }: { file: SlackFile; compact?: boolean }) => {
  const [errored, setErrored] = useState(false);
  // Se a imagem falhar carregar (URL protegida sem proxy), cai no chip
  if (errored || !file.thumb360) return <FileChip file={file} compact={compact} />;

  return (
    <a
      href={downloadUrl(file)}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-md border border-border hover:border-primary/50 transition-colors"
      title={`${file.name} (${formatBytes(file.size)})`}
    >
      <img
        src={file.thumb360}
        alt={file.name}
        onError={() => setErrored(true)}
        className={
          compact
            ? "h-12 w-auto max-w-[80px] object-cover"
            : "h-16 w-auto max-w-[120px] object-cover"
        }
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <Download
          size={compact ? 12 : 14}
          className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
        />
      </div>
    </a>
  );
};

const SlackFilesList = ({ files, compact = false }: SlackFilesListProps) => {
  if (!files || files.length === 0) return null;

  // Tudo lado a lado — imagens e chips no mesmo flex wrap pra harmonizar tamanho
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-1.5" : "mt-2"}`}>
      {files.map((f) =>
        f.mimetype.startsWith("image/") ? (
          <ImageThumb key={f.id} file={f} compact={compact} />
        ) : (
          <FileChip key={f.id} file={f} compact={compact} />
        )
      )}
    </div>
  );
};

export default SlackFilesList;
