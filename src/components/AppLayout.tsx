import { useState } from "react";
import { Menu, Workflow } from "lucide-react";
import AppSidebar from "./AppSidebar";
import { branding } from "@/config/brandingLoader";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <AppSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg"
        >
          <Menu size={20} />
        </button>
        {branding.logo ? (
          <img src={branding.logo} alt={branding.name} className="ml-3 h-5 w-auto" />
        ) : (
          <Workflow size={18} className="ml-3 text-primary" />
        )}
        <span className="ml-1.5 font-semibold text-foreground">{branding.name}</span>
      </div>

      <main
        className={`transition-all duration-300 p-4 sm:p-6 pt-18 lg:pt-8 animate-fade-in overflow-x-hidden ${
          collapsed ? "lg:ml-16" : "lg:ml-60"
        }`}
      >
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
