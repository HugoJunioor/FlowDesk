export type ColorThemeId =
  | "oceano"
  | "violeta"
  | "rosa"
  | "esmeralda"
  | "ambar"
  | "rubi"
  | "turquesa"
  | "lavanda"
  | "safira"
  | "grafite"
  | "neon"
  | "aurora"
  | "midnight"
  | "coral"
  | "menta"
  | "flamengo";

export interface ColorTheme {
  id: ColorThemeId;
  label: string;
  previewColor: string;
  /** Usa gradiente nos titulos principais (efeito neon). */
  hasGradient?: boolean;
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: "oceano", label: "Oceano", previewColor: "#3b72b5" },
  { id: "violeta", label: "Violeta", previewColor: "#8b5cf6", hasGradient: true },
  { id: "rosa", label: "Rosa", previewColor: "#ec4899", hasGradient: true },
  { id: "esmeralda", label: "Esmeralda", previewColor: "#10b981", hasGradient: true },
  { id: "ambar", label: "Âmbar", previewColor: "#f59e0b", hasGradient: true },
  { id: "rubi", label: "Rubi", previewColor: "#ef4444", hasGradient: true },
  { id: "turquesa", label: "Turquesa", previewColor: "#06b6d4", hasGradient: true },
  { id: "lavanda", label: "Lavanda", previewColor: "#a78bfa" },
  { id: "safira", label: "Safira", previewColor: "#6366f1", hasGradient: true },
  { id: "grafite", label: "Grafite", previewColor: "#4b5563" },
  // Especiais
  { id: "neon", label: "Neon", previewColor: "#a855f7", hasGradient: true },
  { id: "aurora", label: "Aurora", previewColor: "#14b8a6", hasGradient: true },
  { id: "midnight", label: "Midnight", previewColor: "#3b82f6", hasGradient: true },
  { id: "coral", label: "Coral", previewColor: "#fb7185", hasGradient: true },
  { id: "menta", label: "Menta", previewColor: "#34d399" },
  { id: "flamengo", label: "Flamengo", previewColor: "#E40521", hasGradient: true },
];

export const DEFAULT_COLOR_THEME: ColorThemeId = "oceano";
export const DEFAULT_MODE = "light" as const;
export const THEME_STORAGE_KEY = "fd-theme";
