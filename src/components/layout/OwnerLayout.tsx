import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Building2, Home, Calendar, LogOut, Menu, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/owner', label: 'Dashboard', icon: Home },
  { href: '/owner/properties', label: 'My Properties', icon: Building2 },
  { href: '/owner/appointments', label: 'Appointments', icon: Calendar },
  { href: '/owner/profile', label: 'Profile', icon: User },
];

const OwnerLayout = () => {
  const { userProfile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={cn("fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-primary"><Building2 className="w-5 h-5 text-primary-foreground" /></div>
            <span className="font-bold text-lg">Owner Portal</span>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></Button>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg transition-colors", location.pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground")}>
              <item.icon className="w-5 h-5" /><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="mb-4 px-4"><p className="text-sm font-medium">{userProfile?.name || 'Owner'}</p><p className="text-xs text-muted-foreground">{userProfile?.email}</p></div>
          <Button variant="outline" className="w-full" onClick={signOut}><LogOut className="w-4 h-4 mr-2" />Sign Out</Button>
        </div>
      </aside>
      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></Button>
            <h1 className="text-xl font-semibold">{navItems.find(item => item.href === location.pathname)?.label || 'Dashboard'}</h1>
            <div className="w-10" />
          </div>
        </header>
        <main className="p-6"><Outlet /></main>
      </div>
    </div>
  );
};

export default OwnerLayout;
