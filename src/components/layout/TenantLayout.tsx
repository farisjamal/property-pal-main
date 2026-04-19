import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Building2, Home, Calendar, LogOut, Menu, X, Search, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navItems = [
  { href: '/tenant', label: 'Dashboard', icon: Home },
  { href: '/tenant/properties', label: 'Browse Properties', icon: Search },
  { href: '/tenant/appointments', label: 'My Appointments', icon: Calendar },
  { href: '/tenant/profile', label: 'Profile', icon: User },
];

const TenantLayout = () => {
  const { userProfile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden flex text-foreground">
      
      {/* Corporate Minimalist Background */}
      <div className="fixed inset-0 bg-background pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-100 via-transparent to-transparent dark:from-zinc-900/30 dark:via-transparent pointer-events-none z-0" />

      {/* Mobile Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      {/* Enterprise Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 bg-card/80 backdrop-blur-xl border-r border-border shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="block font-semibold text-lg tracking-tight text-foreground">PropertyBook</span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Tenant Portal</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden hover:bg-secondary/60" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-4 px-5 flex-1 overflow-y-auto">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3 ml-2 mt-4">Menu</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link 
                  key={item.href} 
                  to={item.href} 
                  onClick={() => setSidebarOpen(false)} 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200", 
                    isActive 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("w-[18px] h-[18px]", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-border bg-card/60 mt-auto">
           <div className="flex items-center gap-3 mb-5 px-1">
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate text-foreground">{userProfile?.name || 'Tenant'}</p>
                <p className="text-xs text-muted-foreground truncate">{userProfile?.email}</p>
              </div>
           </div>
           <Button variant="outline" className="w-full text-sm rounded-lg border-border bg-transparent shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors" onClick={signOut}>
             <LogOut className="w-4 h-4 mr-2" /> Sign Out
           </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:ml-72 flex-1 flex flex-col min-h-screen relative z-10 w-full overflow-hidden">
        
        {/* Crisp Enterprise Header */}
        <header className="sticky top-0 z-30 pt-4 px-4 sm:px-6 lg:px-8">
          <div className="bg-card/80 backdrop-blur-xl border border-border shadow-sm rounded-xl p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0 hover:bg-secondary/60" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                {navItems.find(item => item.href === location.pathname)?.label || 'Dashboard'}
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/40 border border-border">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">Tenant Edition</span>
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TenantLayout;
