import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Tarefas from "./pages/Tarefas.tsx";
import Cadastros from "./pages/Cadastros.tsx";
import Relatorios from "./pages/Relatorios.tsx";
import Demandas from "./pages/Demandas.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import Login from "./pages/Login.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/tarefas" element={<Tarefas />} />
      <Route path="/cadastros" element={<Cadastros />} />
      <Route path="/demandas" element={<Demandas />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
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
