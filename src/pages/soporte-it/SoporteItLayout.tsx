import { NavLink, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { isSoporteItAdmin } from '@/permissions/soporteIt';

export function SoporteItLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const canManageSoporteIt = isSoporteItAdmin(user);

  const tabs = canManageSoporteIt
    ? [
        { to: '/soporte-it/equipos', label: 'Equipos' },
        { to: '/soporte-it/incidentes', label: 'Incidentes' },
      ]
    : [
        { to: '/soporte-it/mis-equipos', label: 'Mis Equipos' },
        { to: '/soporte-it/mis-incidentes', label: 'Mis Incidentes' },
        { to: '/soporte-it/reportar', label: 'Reportar Incidente' },
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
