import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Demandas from "./pages/Demandas.tsx";
import DemandasSql from "./pages/DemandasSql.tsx";
import Infra from "./pages/Infra.tsx";
import Notificacoes from "./pages/Notificacoes.tsx";
import Notas from "./pages/Notas.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import UserManagement from "./pages/UserManagement.tsx";
import GroupsManagement from "./pages/GroupsManagement.tsx";
import ChannelRouting from "./pages/ChannelRouting.tsx";
import Profile from "./pages/Profile.tsx";
import Login from "./pages/Login.tsx";
import LoginV2Page from "./modules/auth/pages/LoginV2Page.tsx";
import NotFound from "./pages/NotFound.tsx";
import { DemoBanner } from "./components/DemoBanner.tsx";

// Defaults sensatos pro React Query no padrao Just:
// - staleTime 30s: caches "fresh" por meio minuto (UI nao refetch a cada mount)
// - refetchOnWindowFocus false: evita refetch ao trocar de aba (ruido)
// - retry 1: tenta 1 vez extra antes de mostrar erro
// - 401 vem do interceptor do apiClient (refresh automatico)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const AppRoutes = () => {
  const { isAuthenticated, mustChangePassword, currentUser, initialized } = useAuth();

  // Wait for localStorage init
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // /login-v2 publica — acessivel mesmo sem auth legacy (testa novo stack)
  if (window.location.pathname === '/login-v2') {
    return (
      <Routes>
        <Route path="/login-v2" element={<LoginV2Page />} />
      </Routes>
    );
  }

  // Not logged in or must change password → Login page handles both flows
  if (!isAuthenticated || mustChangePassword) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login-v2" element={<LoginV2Page />} />
      <Route path="/demandas" element={<Demandas />} />
      <Route path="/demandas-sql" element={<DemandasSql />} />
      <Route path="/infra" element={<Infra />} />
      <Route path="/notificacoes" element={<Notificacoes />} />
      <Route path="/notas" element={<Notas />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      <Route path="/perfil" element={<Profile />} />
      {currentUser?.role === "master" && (
        <Route path="/usuarios" element={<UserManagement />} />
      )}
      {currentUser?.role === "master" && (
        <Route path="/grupos" element={<GroupsManagement />} />
      )}
      {currentUser?.role === "master" && (
        <Route path="/grupos-demandas" element={<ChannelRouting />} />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter>
              <DemoBanner />
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
