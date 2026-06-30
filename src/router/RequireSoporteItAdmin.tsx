import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { isSoporteItAdmin } from '@/permissions/soporteIt';

export function RequireSoporteItAdmin() {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return null;
  if (!isSoporteItAdmin(user)) return <Navigate to="/soporte-it/mis-equipos" replace />;
  return <Outlet />;
}
