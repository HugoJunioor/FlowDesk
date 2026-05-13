/**
 * Copia texto para a area de transferencia.
 *
 * Usa navigator.clipboard quando disponivel (HTTPS/localhost), com fallback
 * para document.execCommand('copy') em contexto nao-seguro (HTTP via IP de rede).
 *
 * @returns Promise<boolean> true se copiou com sucesso
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Caminho moderno (requer contexto seguro)
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through para fallback */
    }
  }

  // Fallback: textarea invisivel + execCommand('copy')
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.pointerEvents = "none";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
