import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Demandas from "./pages/Demandas.tsx";
import DemandasSql from "./pages/DemandasSql.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import UserManagement from "./pages/UserManagement.tsx";
import Profile from "./pages/Profile.tsx";
import Login from "./pages/Login.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

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

  // Not logged in or must change password → Login page handles both flows
  if (!isAuthenticated || mustChangePassword) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/demandas" element={<Demandas />} />
      <Route path="/demandas-sql" element={<DemandasSql />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      <Route path="/perfil" element={<Profile />} />
      {currentUser?.role === "master" && (
        <Route path="/usuarios" element={<UserManagement />} />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
