import { NavLink, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { ModuleKey } from '@/types';

export function LogisticaLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const isLogisticaAdmin = user?.modules?.[ModuleKey.LOGISTICA]?.role === 'ADMIN';

  const tabs = [
    { to: '/logistica/remitos', label: 'Remitos' },
    { to: '/logistica/mapa',    label: 'Mapa'    },
    ...(isLogisticaAdmin ? [{ to: '/logistica/tags', label: 'Tags' }] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card shrink-0">
        <nav className="flex gap-0 px-4 overflow-x-auto">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                [
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                ].join(' ')
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
