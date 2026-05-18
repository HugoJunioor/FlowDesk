/**
 * Coordenadas do caret dentro de um textarea/input.
 *
 * Tecnica do "mirror div": clona os estilos do textarea num <div>
 * invisivel, insere o texto ate a posicao do cursor + um span marcador,
 * e mede o offset do span. Funciona pra textareas com line breaks,
 * fontes proporcionais, padding, border, etc.
 *
 * Retorna posicao em coordenadas de VIEWPORT (compativel com position: fixed).
 */

const MIRROR_PROPS = [
  "direction", "boxSizing", "width", "height", "overflowX", "overflowY",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "borderStyle",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize",
  "fontSizeAdjust", "lineHeight", "fontFamily",
  "textAlign", "textTransform", "textIndent", "textDecoration",
  "letterSpacing", "wordSpacing",
  "tabSize", "MozTabSize",
] as const;

export function getCaretCoordinates(
  el: HTMLTextAreaElement | HTMLInputElement,
  position: number
): { top: number; left: number; height: number } {
  const isFirefox = "mozInnerScreenX" in window;

  const div = document.createElement("div");
  div.id = "fd-caret-mirror";
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(el);
  const isInput = el.nodeName === "INPUT";

  style.whiteSpace = "pre-wrap";
  if (!isInput) style.wordWrap = "break-word";

  // off-screen
  style.position = "absolute";
  style.visibility = "hidden";
  style.top = "0";
  style.left = "0";

  MIRROR_PROPS.forEach((prop) => {
    if (isInput && prop === "lineHeight") {
      style.lineHeight = computed.height;
    } else {
      // @ts-expect-error string indexing
      style[prop] = computed[prop];
    }
  });

  if (isFirefox) {
    if (el.scrollHeight > parseInt(computed.height, 10)) style.overflowY = "scroll";
  } else {
    style.overflow = "hidden";
  }

  div.textContent = el.value.substring(0, position);
  if (isInput) div.textContent = div.textContent.replace(/\s/g, " ");

  const span = document.createElement("span");
  // span vazio nao tem dimensao; um caractere zero-width garante medicao
  span.textContent = el.value.substring(position) || ".";
  div.appendChild(span);

  const rect = el.getBoundingClientRect();
  const result = {
    top: rect.top + (span.offsetTop - el.scrollTop) + parseInt(computed.borderTopWidth, 10),
    left: rect.left + (span.offsetLeft - el.scrollLeft) + parseInt(computed.borderLeftWidth, 10),
    height: parseInt(computed.lineHeight, 10) || parseInt(computed.fontSize, 10) * 1.2,
  };

  document.body.removeChild(div);
  return result;
}
