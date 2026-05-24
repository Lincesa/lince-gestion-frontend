import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { AuthUser } from '@/types';
import { APP_MODULE_NAV, isNavItemVisible } from '@/modules/registry';

interface SidebarProps {
  user: AuthUser;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ user, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const visible = APP_MODULE_NAV.filter((entry) => isNavItemVisible(entry, user));

  const navContent = (
    <>
      <div className="flex items-center justify-between p-2">
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Cerrar menú"
          className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
          className="hidden md:flex ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 px-2 pb-4 space-y-1">
        {visible.map(({ key, label, path, Icon }) => (
          <NavLink
            key={key}
            to={path}
            end={path === '/'}
            onClick={onMobileClose}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed ? 'md:justify-center' : '',
              ].join(' ')
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-[1001] flex flex-col w-64 bg-card border-r border-border transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={[
          'hidden md:flex flex-col h-full bg-card border-r border-border transition-all duration-200',
          collapsed ? 'w-14' : 'w-56',
        ].join(' ')}
      >
        {navContent}
      </aside>
    </>
  );
}
