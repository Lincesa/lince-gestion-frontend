import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { resolveFieldJailRedirect } from './fieldJail';

export function PrivateRoute() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const redirect = resolveFieldJailRedirect({
    area: user?.area,
    pathname: location.pathname,
    mustChangePassword: user?.mustChangePassword,
  });
  if (redirect) return <Navigate to={redirect} replace />;

  return <Outlet />;
}
