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
  | "grafite";

export interface ColorTheme {
  id: ColorThemeId;
  label: string;
  previewColor: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: "oceano", label: "Oceano", previewColor: "#3b72b5" },
  { id: "violeta", label: "Violeta", previewColor: "#7c3aed" },
  { id: "rosa", label: "Rosa", previewColor: "#e11d6a" },
  { id: "esmeralda", label: "Esmeralda", previewColor: "#059669" },
  { id: "ambar", label: "Âmbar", previewColor: "#d97706" },
  { id: "rubi", label: "Rubi", previewColor: "#dc2626" },
  { id: "turquesa", label: "Turquesa", previewColor: "#0d9488" },
  { id: "lavanda", label: "Lavanda", previewColor: "#7c5cbf" },
  { id: "safira", label: "Safira", previewColor: "#4f46e5" },
  { id: "grafite", label: "Grafite", previewColor: "#4b5563" },
];

export const DEFAULT_COLOR_THEME: ColorThemeId = "oceano";
export const DEFAULT_MODE = "light" as const;
export const THEME_STORAGE_KEY = "fd-theme";
