import { Outlet, NavLink } from 'react-router-dom';
import { BarChart3, LayoutDashboard, Plus, Tag } from 'lucide-react';

const navItems = [
  { to: '/conciliaciones', end: true, icon: LayoutDashboard, label: 'Conciliaciones' },
  { to: '/conciliaciones/dashboard', end: true, icon: BarChart3, label: 'Dashboard' },
  { to: '/conciliaciones/nueva', end: true, icon: Plus, label: 'Nueva' },
  { to: '/conciliaciones/categorias', end: false, icon: Tag, label: 'Categorías' },
];

export function ConciliacionesLayout() {
  return (
    <div className="flex flex-col h-full gap-0">
      <nav className="flex items-center gap-1 border-b px-4 py-2 bg-card overflow-x-auto">
        {navItems.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}
