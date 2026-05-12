import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { FlowDeskUser } from "@/types/auth";
import {
  initializeAuth,
  getUserById,
  getUserByLogin,
  checkPasswordAndMigrate,
  setSession,
  getSession,
  clearSession,
  changeUserPassword,
  getPasswordStrength,
  isWeakPassword,
} from "@/lib/authStorage";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: FlowDeskUser | null;
  mustChangePassword: boolean;
  initialized: boolean;
  username: string;
  login: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [initialized, setInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<FlowDeskUser | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const { loadForUser, clearUser: clearUserTheme } = useTheme();
  const { loadForUser: loadLangForUser, clearUser: clearUserLang } = useLanguage();

  useEffect(() => {
    initializeAuth().then(() => {
      const session = getSession();
      if (session) {
        const user = getUserById(session.userId);
        if (user && user.status === "active") {
          setCurrentUser(user);
          setMustChangePassword(user.isFirstAccess);
          loadForUser(user.id, user.themePreferences);
          loadLangForUser(user.id, user.language);
        } else {
          clearSession();
        }
      }
      setInitialized(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (loginInput: string, password: string) => {
    if (!loginInput || !password) {
      return { success: false, error: "Preencha todos os campos" };
    }

    // Rate limit: 5 tentativas / 5 min por login (anti brute-force)
    const RL_KEY = `fd_login_rl_${loginInput.toLowerCase().trim()}`;
    const RL_MAX = 5;
    const RL_WINDOW = 15 * 60 * 1000; // 15min de lockout apos 5 tentativas falhas
    try {
      const raw = localStorage.getItem(RL_KEY);
      if (raw) {
        const rl = JSON.parse(raw) as { count: number; until: number };
        if (rl.until && Date.now() < rl.until) {
          const secs = Math.ceil((rl.until - Date.now()) / 1000);
          return { success: false, error: `Muitas tentativas. Tente novamente em ${secs}s.` };
        }
      }
    } catch { /* ignore */ }

    const user = getUserByLogin(loginInput);
    const recordFail = () => {
      try {
        const raw = localStorage.getItem(RL_KEY);
        const rl = raw ? (JSON.parse(raw) as { count: number; until: number }) : { count: 0, until: 0 };
        rl.count = (rl.count || 0) + 1;
        if (rl.count >= RL_MAX) {
          rl.until = Date.now() + RL_WINDOW;
          rl.count = 0;
        }
        localStorage.setItem(RL_KEY, JSON.stringify(rl));
      } catch { /* ignore */ }
    };

    if (!user) {
      recordFail();
      return { success: false, error: "Usuário ou senha inválidos" };
    }
    if (user.status === "blocked") {
      return { success: false, error: "Conta bloqueada. Contate o administrador." };
    }
    const valid = await checkPasswordAndMigrate(user, password);
    if (!valid) {
      recordFail();
      return { success: false, error: "Usuário ou senha inválidos" };
    }
    try { localStorage.removeItem(RL_KEY); } catch { /* ignore */ }
    setSession(user);
    setCurrentUser(user);
    setMustChangePassword(user.isFirstAccess);
    loadForUser(user.id, user.themePreferences);
    loadLangForUser(user.id, user.language);
    return { success: true };
  }, [loadForUser, loadLangForUser]);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setMustChangePassword(false);
    clearUserTheme();
    clearUserLang();
  }, [clearUserTheme, clearUserLang]);

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!currentUser) return { success: false, error: "Sessão expirada. Faça login novamente." };
      if (isWeakPassword(newPassword)) {
        return { success: false, error: "Senha muito comum. Escolha uma senha mais segura." };
      }
      const strength = getPasswordStrength(newPassword);
      if (!strength.isStrong) {
        return { success: false, error: "Senha fraca. Use ao menos 10 caracteres com maiúscula, minúscula, número e símbolo." };
      }
      const saved = await changeUserPassword(currentUser.id, newPassword);
      if (!saved) return { success: false, error: "Não foi possível salvar a senha. Tente novamente." };
      const updated = getUserById(currentUser.id);
      if (!updated) return { success: false, error: "Erro ao atualizar sessão. Faça login novamente." };
      setCurrentUser(updated);
      setSession(updated);
      setMustChangePassword(false);
      return { success: true };
    },
    [currentUser]
  );

  const refreshUser = useCallback(() => {
    if (!currentUser) return;
    const updated = getUserById(currentUser.id);
    if (updated) setCurrentUser(updated);
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!currentUser,
        currentUser,
        mustChangePassword,
        initialized,
        username: currentUser?.name || currentUser?.login || "",
        login,
        logout,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
