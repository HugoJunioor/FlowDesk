/**
 * Renderiza arquivos anexados a uma mensagem Slack.
 *
 * Formato visual:
 * - Imagens (mimetype image/*): thumb 360 inline + click pra abrir grande
 * - PDFs: chip com icone de arquivo + nome + tamanho + botao baixar
 * - Outros: chip generico + baixar
 *
 * Download de arquivo Slack precisa do token Bot (urlPrivate so abre com auth).
 * Em prod, o flowdesk-api proxia o download via GET /slack/file?id=X.
 * Em demo (sem flowdesk-api configurada), mostra o chip mas sem download real.
 */
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

/** URL pra baixar o arquivo. Usa flowdesk-api proxy em prod, ou direto se isPublic. */
function downloadUrl(file: SlackFile): string {
  if (file.isPublic && file.urlPrivate) return file.urlPrivate;
  // Backend proxy (precisa flowdesk-api configurada)
  const apiBase =
    import.meta.env.VITE_FLOWDESK_API_URL ??
    "https://flowdesk-api-production-21cf.up.railway.app";
  return `${apiBase}/slack/file/${encodeURIComponent(file.id)}`;
}

const SlackFilesList = ({ files, compact = false }: SlackFilesListProps) => {
  if (!files || files.length === 0) return null;

  // Separa imagens (renderizadas grandes) das demais (chips compactos)
  const images = files.filter((f) => f.mimetype.startsWith("image/"));
  const others = files.filter((f) => !f.mimetype.startsWith("image/"));

  return (
    <div className={compact ? "space-y-1.5 mt-1.5" : "space-y-2 mt-2"}>
      {/* Imagens — thumbs lado a lado */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((f) => (
            <a
              key={f.id}
              href={downloadUrl(f)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block overflow-hidden rounded-md border border-border hover:border-primary/50 transition-colors"
              title={`${f.name} (${formatBytes(f.size)})`}
            >
              {f.thumb360 ? (
                <img
                  src={f.thumb360}
                  alt={f.name}
                  className={
                    compact
                      ? "h-20 w-auto max-w-[160px] object-cover"
                      : "h-32 w-auto max-w-[240px] object-cover"
                  }
                  loading="lazy"
                />
              ) : (
                <div className={
                  compact
                    ? "h-20 w-32 bg-muted flex items-center justify-center"
                    : "h-32 w-48 bg-muted flex items-center justify-center"
                }>
                  <ImageIcon size={compact ? 20 : 28} className="text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Download
                  size={compact ? 14 : 18}
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Outros arquivos — chips */}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {others.map((f) => {
            const Icon = iconForMime(f.mimetype);
            return (
              <a
                key={f.id}
                href={downloadUrl(f)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-muted/50 hover:bg-muted border border-border rounded-md px-2 py-1.5 text-xs transition-colors"
                title={`${f.name} (${formatBytes(f.size)})`}
              >
                <Icon size={13} className="text-primary shrink-0" />
                <span className="truncate max-w-[200px]">{f.name}</span>
                <span className="text-muted-foreground text-[10px]">{formatBytes(f.size)}</span>
                <Download size={11} className="opacity-50 shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SlackFilesList;
