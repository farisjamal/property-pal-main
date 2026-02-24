import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Home, Calendar, LogOut, Menu, X, Search, User, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/tenant', label: 'Dashboard', icon: Home },
  { href: '/tenant/properties', label: 'Browse Properties', icon: Search },
  { href: '/tenant/appointments', label: 'My Appointments', icon: Calendar },
  { href: '/tenant/profile', label: 'Profile', icon: User },
];

const TenantLayout = () => {
  const { userProfile, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = (userProfile?.name || 'T')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border/60">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shrink-0">
            <Home className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold text-xl tracking-tight text-foreground">
            PropertyPal
          </span>
        </Link>
        <button
          className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="section-label px-3 mb-3">Menu</p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <item.icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : '')} />
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-5 space-y-1 border-t border-border/60 pt-4">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all duration-150"
        >
          {isDark
            ? <Sun className="w-4 h-4 shrink-0 text-amber-400" />
            : <Moon className="w-4 h-4 shrink-0" />
          }
          <span className="flex-1 text-left">{isDark ? 'Light mode' : 'Dark mode'}</span>
          {/* Toggle pill */}
          <div
            className={cn(
              'relative rounded-full transition-colors duration-300 shrink-0',
              isDark ? 'bg-primary' : 'bg-muted border border-border'
            )}
            style={{ width: 36, height: 20 }}
          >
            <span
              className="absolute top-[2px] rounded-full bg-white shadow-sm transition-all duration-300"
              style={{ width: 16, height: 16, left: isDark ? 18 : 2 }}
            />
          </div>
        </button>

        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/40">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground leading-tight">
              {userProfile?.name || 'Tenant'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {userProfile?.email || ''}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border/60 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/60">
          <div className="flex items-center gap-4 px-6 py-4">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <h1 className="font-semibold text-base text-foreground">
              {navItems.find(item => item.href === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TenantLayout;
