import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FileText, LogOut, Route, Truck, UserRound } from 'lucide-react';
import { Layout } from './Layout';
import { useAppSelector, useAppDispatch } from '@/store';
import { clearAuth } from '@/store/auth/authSlice';
import { authApi } from '@/api/auth';
import { isFieldArea } from '@/auth/fieldArea';

export function AppLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      dispatch(clearAuth());
      navigate('/login', { replace: true });
    }
  };

  if (!user) return null;
  if (isFieldArea(user.area)) {
    const isTransportUser = user.area?.toUpperCase() === 'TRANSPORTE';
    const links = [
      ...(isTransportUser
        ? [{ to: '/logistica/mi-transporte', label: 'Mi transporte', Icon: Truck }]
        : []),
      ...(isTransportUser
        ? [{ to: '/logistica/viajes', label: 'Viajes', Icon: Route }]
        : []),
      { to: '/ocr/remitos', label: 'Remitos', Icon: FileText },
      { to: '/perfil', label: 'Perfil', Icon: UserRound },
    ];
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card px-3 sm:px-5 py-2 flex items-center gap-1 overflow-x-auto">
          <img src="/logo_lince.png" alt="Lince SA" className="h-8 w-8 rounded-full object-cover mr-2 shrink-0" />
          {links.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => [
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent whitespace-nowrap"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Outlet />
    </Layout>
  );
}
