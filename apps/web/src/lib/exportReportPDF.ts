/**
 * Exporta o relatório BI atual como PDF usando window.print().
 *
 * Injeta um <style> temporário com @media print otimizado para A4:
 * - Esconde botões, navegação, toasts e elementos interativos
 * - Força quebras de página entre seções principais
 * - Remove sombras e bordas coloridas que ficam feias em B&W
 *
 * Após o diálogo de impressão fechar, o style é removido.
 */

const PRINT_STYLE_ID = "fd-print-style";

const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 12mm;
  }

  /* Esconde navegacao, botoes, toasts, sidebars */
  nav,
  aside,
  header,
  [data-sonner-toaster],
  [role="dialog"],
  [data-radix-popper-content-wrapper],
  .fd-no-print,
  button,
  [data-sidebar],
  [data-slot="sidebar"] {
    display: none !important;
  }

  /* Garante fundo branco + texto escuro */
  body,
  html {
    background: white !important;
    color: black !important;
    font-size: 11pt;
  }

  /* Remove sombras */
  * {
    box-shadow: none !important;
    text-shadow: none !important;
  }

  /* Cards sem bordas coloridas pesadas */
  .rounded-xl,
  .rounded-lg,
  [class*="Card"] {
    border: 1px solid #ccc !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Quebra de página antes de seções grandes */
  .fd-print-break-before {
    break-before: page;
    page-break-before: always;
  }

  /* Graficos: mantém tamanho razoavel */
  .recharts-wrapper,
  .recharts-responsive-container {
    max-width: 100% !important;
  }

  /* Links: mostra URL */
  a[href]::after {
    content: none !important;
  }

  /* Tabelas nao quebram linha no meio */
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;

export function printReportAsPDF(): void {
  // Remove style anterior se existir (cleanup de chamada anterior)
  const existing = document.getElementById(PRINT_STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);

  // Pequeno delay pra garantir que o estilo foi aplicado antes do print
  setTimeout(() => {
    window.print();
    // Remove após o diálogo fechar — window.print() é síncrono no browser
    // (bloqueia até o usuario fechar o dialogo ou cancelar)
    const el = document.getElementById(PRINT_STYLE_ID);
    if (el) el.remove();
  }, 100);
}
