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
  getPasswordStrength,
  isWeakPassword,
} from "@/lib/authStorage";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { authApi } from "@/modules/auth/api";
import { setAccessToken } from "@/lib/api/client";
import { toApiError } from "@/lib/api/client";
import type { AuthenticatedUser } from "@/modules/auth/types";

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: FlowDeskUser | null;
  mustChangePassword: boolean;
  initialized: boolean;
  username: string;
  login: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  /**
   * Changes the current user's password.
   * `currentPassword` is required by the API. On first-access flows,
   * pass the provisional password the user typed on the login form.
   */
  changePassword: (newPassword: string, currentPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

/** Maps the API AuthenticatedUser shape to the local FlowDeskUser shape used by legacy UI. */
function apiUserToLocal(apiUser: AuthenticatedUser, localFallback?: FlowDeskUser | null): FlowDeskUser {
  return {
    id: apiUser.id,
    login: apiUser.login,
    email: apiUser.email,
    name: apiUser.nome,
    role: apiUser.perfil,
    status: apiUser.status,
    // passwordHash is not needed client-side; using a placeholder keeps the type satisfied
    passwordHash: "",
    isFirstAccess: apiUser.primeiroAcesso,
    passwordResetRequested: false,
    groups: apiUser.grupos,
    // API is the source of truth; fall back to local cache for retro-compat when null
    themePreferences: apiUser.themePreferences ?? localFallback?.themePreferences,
    language: (apiUser.language ?? localFallback?.language) as FlowDeskUser['language'] | undefined,
    createdAt: new Date().toISOString(),
    createdBy: "api",
  };
}

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
        // Restore access token via refresh cookie; if cookie is gone, force logout.
        authApi.refresh()
          .then((authResponse) => {
            const localUser = getUserById(session.userId);
            const user = apiUserToLocal(authResponse.usuario, localUser);
            setCurrentUser(user);
            setMustChangePassword(user.isFirstAccess);
            loadForUser(user.id, user.themePreferences);
            loadLangForUser(user.id, user.language);
          })
          .catch(() => {
            // Refresh token gone/expired — clear session and show login
            clearSession();
            setAccessToken(null);
          })
          .finally(() => {
            // Signal app ready only after refresh settles (success or failure)
            setInitialized(true);
          });
        return;
      }
      setInitialized(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (loginInput: string, password: string) => {
    if (!loginInput || !password) {
      return { success: false, error: "Preencha todos os campos" };
    }

    // In demo mode (VITE_DEMO_MODE=true) the Express API is not running.
    // Fall back to the localStorage-based flow so E2E tests and local demos
    // work without a backend.
    if (import.meta.env.VITE_DEMO_MODE === "true") {
      const localUser = getUserByLogin(loginInput);
      if (!localUser) return { success: false, error: "Usuário ou senha inválidos" };
      if (localUser.status === "blocked") return { success: false, error: "Conta bloqueada. Contate o administrador." };
      const valid = await checkPasswordAndMigrate(localUser, password);
      if (!valid) return { success: false, error: "Usuário ou senha inválidos" };
      setSession(localUser);
      setCurrentUser(localUser);
      setMustChangePassword(localUser.isFirstAccess);
      loadForUser(localUser.id, localUser.themePreferences);
      loadLangForUser(localUser.id, localUser.language);
      return { success: true };
    }

    try {
      const authResponse = await authApi.login({ login: loginInput, senha: password });
      const localUser = getUserById(authResponse.usuario.id);
      // API is source of truth for prefs; local cache is fallback for retro-compat
      const user = apiUserToLocal(authResponse.usuario, localUser);

      setSession(user);
      setCurrentUser(user);
      setMustChangePassword(user.isFirstAccess);
      loadForUser(user.id, user.themePreferences);
      loadLangForUser(user.id, user.language);

      return { success: true };
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.status === 429) {
        return { success: false, error: "Muitas tentativas. Aguarde e tente novamente." };
      }
      if (apiErr.status === 403) {
        return { success: false, error: apiErr.message || "Conta bloqueada. Contate o administrador." };
      }
      // 401 or network error
      return { success: false, error: "Usuário ou senha inválidos" };
    }
  }, [loadForUser, loadLangForUser]);

  const logout = useCallback(() => {
    // Fire-and-forget: revoke refresh token server-side
    authApi.logout().catch(() => { /* best-effort */ });
    clearSession();
    setCurrentUser(null);
    setMustChangePassword(false);
    clearUserTheme();
    clearUserLang();
  }, [clearUserTheme, clearUserLang]);

  const changePassword = useCallback(
    async (newPassword: string, currentPassword: string) => {
      if (!currentUser) return { success: false, error: "Sessão expirada. Faça login novamente." };
      if (isWeakPassword(newPassword)) {
        return { success: false, error: "Senha muito comum. Escolha uma senha mais segura." };
      }
      const strength = getPasswordStrength(newPassword);
      if (!strength.isStrong) {
        return { success: false, error: "Senha fraca. Use ao menos 10 caracteres com maiúscula, minúscula, número e símbolo." };
      }

      try {
        await authApi.changePassword({ senhaAtual: currentPassword, novaSenha: newPassword });
        // Re-fetch user state from API after password change
        const updated = await authApi.me();
        const localUser = getUserById(currentUser.id);
        const mergedUser = apiUserToLocal(updated, localUser);
        setCurrentUser(mergedUser);
        setSession(mergedUser);
        setMustChangePassword(false);
        return { success: true };
      } catch (err) {
        const apiErr = toApiError(err);
        if (apiErr.status === 401) {
          return { success: false, error: "Senha atual incorreta." };
        }
        return { success: false, error: apiErr.message || "Não foi possível salvar a senha. Tente novamente." };
      }
    },
    [currentUser]
  );

  const refreshUser = useCallback(() => {
    if (!currentUser) return;
    authApi.me()
      .then((updated) => {
        const localUser = getUserById(currentUser.id);
        setCurrentUser(apiUserToLocal(updated, localUser));
      })
      .catch(() => { /* ignore — best-effort refresh */ });
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
