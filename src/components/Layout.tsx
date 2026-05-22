import { useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import type { AuthUser } from '@/types';
import { DarkModeToggle } from './ui/DarkModeToggle';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  user: AuthUser;
  onLogout: () => void;
  children: React.ReactNode;
}

export function Layout({ user, onLogout, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-card shrink-0 z-30">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo_lince.png" alt="Lince SA" className="h-8 w-8 rounded-full object-cover" />
          <span className="font-bold text-lg tracking-tight text-primary hidden sm:inline">Lince SA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">{user.name}</span>
          <DarkModeToggle />
          <button
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <Sidebar user={user} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
