import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ColorThemeId } from "@/config/themes";
import { DEFAULT_COLOR_THEME, DEFAULT_MODE, THEME_STORAGE_KEY, COLOR_THEMES } from "@/config/themes";

type Mode = "light" | "dark";

interface ThemeContextType {
  mode: Mode;
  colorTheme: ColorThemeId;
  toggleMode: () => void;
  setColorTheme: (id: ColorThemeId) => void;
  /** @deprecated use mode */
  theme: Mode;
  /** @deprecated use toggleMode */
  toggleTheme: () => void;
}

interface StoredTheme {
  mode: Mode;
  colorTheme: ColorThemeId;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: DEFAULT_MODE,
  colorTheme: DEFAULT_COLOR_THEME,
  toggleMode: () => {},
  setColorTheme: () => {},
  theme: DEFAULT_MODE,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function isValidMode(v: unknown): v is Mode {
  return v === "light" || v === "dark";
}

function isValidColorTheme(v: unknown): v is ColorThemeId {
  return typeof v === "string" && COLOR_THEMES.some((t) => t.id === v);
}

function readStoredTheme(): StoredTheme {
  try {
    // New format
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: isValidMode(parsed.mode) ? parsed.mode : DEFAULT_MODE,
        colorTheme: isValidColorTheme(parsed.colorTheme) ? parsed.colorTheme : DEFAULT_COLOR_THEME,
      };
    }
    // Migrate from old "theme" key
    const legacy = localStorage.getItem("theme");
    if (legacy && isValidMode(legacy)) {
      const migrated: StoredTheme = { mode: legacy, colorTheme: DEFAULT_COLOR_THEME };
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem("theme");
      return migrated;
    }
  } catch { /* ignore */ }
  return { mode: DEFAULT_MODE, colorTheme: DEFAULT_COLOR_THEME };
}

function applyThemeClasses(mode: Mode, colorTheme: ColorThemeId) {
  const root = document.documentElement;
  // Remove all theme-* classes and mode classes
  const toRemove: string[] = [];
  root.classList.forEach((cls) => {
    if (cls.startsWith("theme-") || cls === "light" || cls === "dark") {
      toRemove.push(cls);
    }
  });
  toRemove.forEach((cls) => root.classList.remove(cls));
  // Apply new classes
  root.classList.add(mode, `theme-${colorTheme}`);
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [{ mode, colorTheme }, setThemeState] = useState<StoredTheme>(readStoredTheme);

  useEffect(() => {
    applyThemeClasses(mode, colorTheme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode, colorTheme }));
  }, [mode, colorTheme]);

  const toggleMode = useCallback(() => {
    setThemeState((prev) => ({ ...prev, mode: prev.mode === "light" ? "dark" : "light" }));
  }, []);

  const setColorTheme = useCallback((id: ColorThemeId) => {
    if (isValidColorTheme(id)) {
      setThemeState((prev) => ({ ...prev, colorTheme: id }));
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colorTheme,
        toggleMode,
        setColorTheme,
        // Backward compat
        theme: mode,
        toggleTheme: toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
