import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { ColorThemeId } from "@/config/themes";
import { DEFAULT_COLOR_THEME, DEFAULT_MODE, THEME_STORAGE_KEY, COLOR_THEMES } from "@/config/themes";
import type { UserThemePreferences } from "@/types/auth";

type Mode = "light" | "dark";

interface ThemeContextType {
  mode: Mode;
  colorTheme: ColorThemeId;
  toggleMode: () => void;
  setColorTheme: (id: ColorThemeId) => void;
  /** Called by AuthContext on login to load user's saved theme */
  loadForUser: (userId: string, prefs?: UserThemePreferences) => void;
  /** Called by AuthContext on logout to reset to defaults */
  clearUser: () => void;
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
  loadForUser: () => {},
  clearUser: () => {},
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

function parsePrefs(prefs?: UserThemePreferences): StoredTheme | null {
  if (!prefs) return null;
  const mode = isValidMode(prefs.mode) ? prefs.mode : null;
  const colorTheme = isValidColorTheme(prefs.colorTheme) ? prefs.colorTheme : null;
  if (!mode && !colorTheme) return null;
  return {
    mode: mode || DEFAULT_MODE,
    colorTheme: colorTheme || DEFAULT_COLOR_THEME,
  };
}

function applyThemeClasses(mode: Mode, colorTheme: ColorThemeId) {
  const root = document.documentElement;
  const toRemove: string[] = [];
  root.classList.forEach((cls) => {
    if (cls.startsWith("theme-") || cls === "light" || cls === "dark") {
      toRemove.push(cls);
    }
  });
  toRemove.forEach((cls) => root.classList.remove(cls));
  root.classList.add(mode, `theme-${colorTheme}`);
}

/** Save theme prefs to the user object in localStorage (authStorage) */
function saveToUserProfile(userId: string, mode: Mode, colorTheme: ColorThemeId) {
  try {
    const raw = localStorage.getItem("fd_users_v2");
    if (!raw) return;
    const users = JSON.parse(raw);
    const idx = users.findIndex((u: { id: string }) => u.id === userId);
    if (idx === -1) return;
    users[idx] = {
      ...users[idx],
      themePreferences: { mode, colorTheme },
    };
    localStorage.setItem("fd_users_v2", JSON.stringify(users));
  } catch { /* ignore */ }
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [{ mode, colorTheme }, setThemeState] = useState<StoredTheme>(readStoredTheme);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    applyThemeClasses(mode, colorTheme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode, colorTheme }));
    // Also persist to user profile if logged in
    if (userIdRef.current) {
      saveToUserProfile(userIdRef.current, mode, colorTheme);
    }
  }, [mode, colorTheme]);

  const toggleMode = useCallback(() => {
    setThemeState((prev) => ({ ...prev, mode: prev.mode === "light" ? "dark" : "light" }));
  }, []);

  const setColorTheme = useCallback((id: ColorThemeId) => {
    if (isValidColorTheme(id)) {
      setThemeState((prev) => ({ ...prev, colorTheme: id }));
    }
  }, []);

  const loadForUser = useCallback((userId: string, prefs?: UserThemePreferences) => {
    userIdRef.current = userId;
    const parsed = parsePrefs(prefs);
    if (parsed) {
      setThemeState(parsed);
    }
  }, []);

  const clearUser = useCallback(() => {
    userIdRef.current = null;
    setThemeState({ mode: DEFAULT_MODE, colorTheme: DEFAULT_COLOR_THEME });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colorTheme,
        toggleMode,
        setColorTheme,
        loadForUser,
        clearUser,
        theme: mode,
        toggleTheme: toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
