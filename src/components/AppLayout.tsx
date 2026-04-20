import { useState, useEffect } from "react";
import { Menu, Workflow } from "lucide-react";
import AppSidebar from "./AppSidebar";
import { branding } from "@/config/brandingLoader";

interface AppLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "fd_sidebar_collapsed";

const AppLayout = ({ children }: AppLayoutProps) => {
  // Estado persistido — senao seria resetado a cada mudanca de rota
  // (AppLayout re-instanciado por cada pagina) e a sidebar abriria sozinha.
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  // Se a preferencia mudar em outro tab, sincroniza
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_COLLAPSED_KEY && e.newValue !== null) {
        setCollapsedState(e.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <AppSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-primary border-b border-primary/80 flex items-center px-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-white/80 hover:text-white rounded-lg"
        >
          <Menu size={20} />
        </button>
        {branding.logo ? (
          <img src={branding.logo} alt={branding.name} className="ml-3 h-7 w-auto" />
        ) : (
          <Workflow size={18} className="ml-3 text-primary" />
        )}
        <span className="ml-1.5 text-sm font-semibold text-white">{branding.name}</span>
      </div>

      <main
        className={`transition-all duration-300 p-4 sm:p-6 pt-20 lg:pt-8 animate-fade-in overflow-x-hidden ${
          collapsed ? "lg:ml-16" : "lg:ml-60"
        }`}
      >
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
