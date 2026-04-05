import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  username: string;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("auth") === "true";
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("username") || "";
  });

  const login = useCallback((user: string, pass: string) => {
    if (user === "master" && pass === "1") {
      setIsAuthenticated(true);
      setUsername(user);
      localStorage.setItem("auth", "true");
      localStorage.setItem("username", user);
      return { success: true };
    }
    return { success: false, error: "Usuário ou senha inválidos" };
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUsername("");
    localStorage.removeItem("auth");
    localStorage.removeItem("username");
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
