import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { Language } from "@/types/auth";
import { DEFAULT_LANGUAGE, translate } from "@/lib/i18n";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  /** Chamado pelo AuthContext ao logar — carrega idioma do perfil do usuario */
  loadForUser: (userId: string, language?: Language) => void;
  /** Chamado no logout — volta ao padrao */
  clearUser: () => void;
}

const STORAGE_KEY = "fd_language";

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (k) => k,
  loadForUser: () => {},
  clearUser: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

function readStoredLanguage(): Language {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "pt-BR" || raw === "en-US" || raw === "es-ES") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

function saveToUserProfile(userId: string, language: Language) {
  try {
    const raw = localStorage.getItem("fd_users_v2");
    if (!raw) return;
    const users = JSON.parse(raw);
    const idx = users.findIndex((u: { id: string }) => u.id === userId);
    if (idx === -1) return;
    users[idx] = { ...users[idx], language };
    localStorage.setItem("fd_users_v2", JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(STORAGE_KEY, language);
    if (userIdRef.current) {
      saveToUserProfile(userIdRef.current, language);
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: string) => translate(key, language), [language]);

  const loadForUser = useCallback((userId: string, userLanguage?: Language) => {
    userIdRef.current = userId;
    if (userLanguage) {
      setLanguageState(userLanguage);
    }
  }, []);

  const clearUser = useCallback(() => {
    userIdRef.current = null;
    setLanguageState(DEFAULT_LANGUAGE);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loadForUser, clearUser }}>
      {children}
    </LanguageContext.Provider>
  );
};
