import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  Menu,
  LogOut,
  Moon,
  Sun,
  X,
  Workflow,
  MessageSquare,
  Users,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { branding } from "@/config/brandingLoader";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/demandas", icon: MessageSquare, label: "Demandas" },
];

interface AppSidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const AppSidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: AppSidebarProps) => {
  const location = useLocation();
  const { username, logout, currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMaster = currentUser?.role === "master";

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : "US";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen bg-sidebar flex flex-col z-50 transition-all duration-300
          ${collapsed ? "w-16" : "w-60"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center justify-center h-16 border-b border-sidebar-border ${collapsed ? "px-2" : "px-4"}`}>
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className="mx-auto text-sidebar-primary hover:text-sidebar-primary-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent"
            >
              {branding.logo ? (
                <img src={branding.logo} alt={branding.name} className="h-5 max-w-[44px] object-contain" />
              ) : (
                <Workflow size={22} />
              )}
            </button>
          ) : (
            <>
              {branding.logo ? (
                <div className="flex items-center gap-3">
                  <img src={branding.logo} alt={branding.name} className="h-8 w-auto shrink-0" />
                  <span className="text-sidebar-primary-foreground font-semibold text-lg tracking-tight">
                    {branding.name}
                  </span>
                </div>
              ) : (
                <>
                  <Workflow size={20} className="text-sidebar-primary shrink-0" />
                  <span className="ml-2 text-sidebar-primary-foreground font-semibold text-lg tracking-tight">
                    {branding.name}
                  </span>
                </>
              )}
              <button
                onClick={() => {
                  if (mobileOpen) setMobileOpen(false);
                  else setCollapsed(true);
                }}
                className="ml-auto text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent"
              >
                {mobileOpen ? <X size={18} /> : <ChevronLeft size={18} />}
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-sidebar-primary rounded-r-full" />
                )}
                <item.icon size={20} className={isActive ? "text-sidebar-primary" : ""} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}

          {/* Master-only: Users */}
          {isMaster && (
            <NavLink
              to="/usuarios"
              onClick={() => setMobileOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                location.pathname === "/usuarios"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              {location.pathname === "/usuarios" && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-sidebar-primary rounded-r-full" />
              )}
              <Users size={20} className={location.pathname === "/usuarios" ? "text-sidebar-primary" : ""} />
              {!collapsed && <span>Usuários</span>}
            </NavLink>
          )}
        </nav>

        {/* User info + profile link */}
        <div className="px-2 py-3 border-t border-sidebar-border">
          <NavLink
            to="/perfil"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
              }`
            }
            title="Meu perfil"
          >
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-xs font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-sidebar-foreground truncate block">
                  {username}
                </span>
                <span className="text-[10px] text-sidebar-muted">
                  {currentUser?.role === "master" ? "Master" : "Usuário"}
                </span>
              </div>
            )}
            {!collapsed && <UserCircle size={14} className="text-sidebar-muted shrink-0" />}
          </NavLink>
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors w-full"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            {!collapsed && <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
          </button>

          <NavLink
            to="/configuracoes"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <Settings size={20} />
            {!collapsed && <span>Configuracoes</span>}
          </NavLink>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-destructive transition-colors w-full"
          >
            <LogOut size={20} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
