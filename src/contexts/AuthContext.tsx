import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { FlowDeskUser } from "@/types/auth";
import {
  initializeAuth,
  getUserById,
  getUserByLogin,
  hashPassword,
  setSession,
  getSession,
  clearSession,
  changeUserPassword,
} from "@/lib/authStorage";

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

  useEffect(() => {
    initializeAuth().then(() => {
      const session = getSession();
      if (session) {
        const user = getUserById(session.userId);
        if (user && user.status === "active") {
          setCurrentUser(user);
          setMustChangePassword(user.isFirstAccess);
        } else {
          clearSession();
        }
      }
      setInitialized(true);
    });
  }, []);

  const login = useCallback(async (loginInput: string, password: string) => {
    if (!loginInput || !password) {
      return { success: false, error: "Preencha todos os campos" };
    }
    const user = getUserByLogin(loginInput);
    if (!user) {
      return { success: false, error: "Usuário ou senha inválidos" };
    }
    if (user.status === "blocked") {
      return { success: false, error: "Conta bloqueada. Contate o administrador." };
    }
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) {
      return { success: false, error: "Usuário ou senha inválidos" };
    }
    setSession(user);
    setCurrentUser(user);
    setMustChangePassword(user.isFirstAccess);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setMustChangePassword(false);
  }, []);

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!currentUser) return { success: false, error: "Não autenticado" };
      await changeUserPassword(currentUser.id, newPassword);
      const updated = getUserById(currentUser.id);
      if (updated) {
        setCurrentUser(updated);
        setMustChangePassword(false);
        setSession(updated);
      }
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
