import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  username: string;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

// Session duration: 8 hours
const SESSION_DURATION = 8 * 60 * 60 * 1000;

// Simple hash function (for demo - real app should use bcrypt on backend)
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Pre-hashed credentials (SHA-256)
// To change: run in console: crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword')).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join(''))
const VALID_CREDENTIALS = {
  usernameHash: "fc613b4dfd6736a7bd268c8a0e74ed0d1c04a959f59dd74ef2874983fd443fc9",
  passwordHash: "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
};

function isSessionValid(): boolean {
  try {
    const session = sessionStorage.getItem("fd_session");
    if (!session) return false;
    const parsed = JSON.parse(session);
    if (!parsed.expires || !parsed.user) return false;
    return Date.now() < parsed.expires;
  } catch {
    return false;
  }
}

function getSessionUser(): string {
  try {
    const session = sessionStorage.getItem("fd_session");
    if (!session) return "";
    const parsed = JSON.parse(session);
    return parsed.user || "";
  } catch {
    return "";
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => isSessionValid());
  const [username, setUsername] = useState(() => getSessionUser());

  const login = useCallback(async (user: string, pass: string) => {
    // Input validation
    if (!user || !pass) {
      return { success: false, error: "Preencha todos os campos" };
    }
    if (user.length > 50 || pass.length > 100) {
      return { success: false, error: "Credenciais invalidas" };
    }

    const [userHash, passHash] = await Promise.all([
      hashString(user.trim().toLowerCase()),
      hashString(pass),
    ]);

    if (userHash === VALID_CREDENTIALS.usernameHash && passHash === VALID_CREDENTIALS.passwordHash) {
      const session = {
        user: user.trim(),
        expires: Date.now() + SESSION_DURATION,
      };
      setIsAuthenticated(true);
      setUsername(user.trim());
      // Use sessionStorage (closes with browser tab, not persistent like localStorage)
      sessionStorage.setItem("fd_session", JSON.stringify(session));
      return { success: true };
    }

    return { success: false, error: "Usuario ou senha invalidos" };
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUsername("");
    sessionStorage.removeItem("fd_session");
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
