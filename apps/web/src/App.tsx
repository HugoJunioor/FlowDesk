import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DemoBanner } from "./components/DemoBanner.tsx";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import ShortcutsHelpModal from "@/components/ShortcutsHelpModal";

// Code splitting por rota — cada page entra como chunk próprio.
// Bundle inicial fica enxuto (Index + dependencies do shell);
// resto carrega só quando o user navegar pra rota.
const Index = lazy(() => import("./pages/Index.tsx"));
const Demandas = lazy(() => import("./pages/Demandas.tsx"));
const DemandasSql = lazy(() => import("./pages/DemandasSql.tsx"));
const Infra = lazy(() => import("./pages/Infra.tsx"));
const Notificacoes = lazy(() => import("./pages/Notificacoes.tsx"));
const Notas = lazy(() => import("./pages/Notas.tsx"));
const Configuracoes = lazy(() => import("./pages/Configuracoes.tsx"));
const UserManagement = lazy(() => import("./pages/UserManagement.tsx"));
const GroupsManagement = lazy(() => import("./pages/GroupsManagement.tsx"));
const ChannelRouting = lazy(() => import("./pages/ChannelRouting.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const LoginV2Page = lazy(() => import("./modules/auth/pages/LoginV2Page.tsx"));
const AuditoriaPage = lazy(() => import("./modules/auditoria/pages/AuditoriaPage.tsx"));
const NotasV2Page = lazy(() => import("./modules/nota/pages/NotasV2Page.tsx"));
const NotificacoesV2Page = lazy(() => import("./modules/notificacao/pages/NotificacoesV2Page.tsx"));
const ConfiguracoesV2Page = lazy(() => import("./modules/configuracoes/pages/ConfiguracoesV2Page.tsx"));
const DemandasV2Page = lazy(() => import("./modules/demanda/pages/DemandasV2Page.tsx"));
const StatusPage = lazy(() => import("./modules/status/pages/StatusPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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

/** Spinner mostrado enquanto chunk lazy não carrega (sub-100ms na maioria) */
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const AppRoutes = () => {
  const { isAuthenticated, mustChangePassword, currentUser, initialized } = useAuth();

  // Wait for localStorage init
  if (!initialized) {
    return <PageLoader />;
  }

  // /login-v2 publica — acessivel mesmo sem auth legacy (testa novo stack)
  if (window.location.pathname === '/login-v2') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login-v2" element={<LoginV2Page />} />
        </Routes>
      </Suspense>
    );
  }

  // Not logged in or must change password → Login page handles both flows
  if (!isAuthenticated || mustChangePassword) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login-v2" element={<LoginV2Page />} />
        <Route path="/demandas" element={<Demandas />} />
        <Route path="/demandas-sql" element={<DemandasSql />} />
        <Route path="/infra" element={<Infra />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/notas" element={<Notas />} />
        <Route path="/notas-v2" element={<NotasV2Page />} />
        <Route path="/notificacoes-v2" element={<NotificacoesV2Page />} />
        <Route path="/configuracoes-v2" element={<ConfiguracoesV2Page />} />
        <Route path="/demandas-v2" element={<DemandasV2Page />} />
        {currentUser?.role === "master" && (
          <Route path="/status" element={<StatusPage />} />
        )}
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
        {currentUser?.role === "master" && (
          <Route path="/auditoria" element={<AuditoriaPage />} />
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

/** Wrapper interno ao BrowserRouter — necessario para useNavigate funcionar. */
const KeyboardShortcutsProvider = () => {
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();
  return <ShortcutsHelpModal open={helpOpen} onOpenChange={setHelpOpen} />;
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
              <KeyboardShortcutsProvider />
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
