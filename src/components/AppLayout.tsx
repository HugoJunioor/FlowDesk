import AppSidebar from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-60 p-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
