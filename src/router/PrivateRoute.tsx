import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store';

export function PrivateRoute() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Force password change before accessing any other route
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  const isTag = user?.area?.toUpperCase() === 'TAG';
  if (isTag && !location.pathname.startsWith('/ocr/remitos') && location.pathname !== '/change-password') {
    return <Navigate to="/ocr/remitos" replace />;
  }

  return <Outlet />;
}
