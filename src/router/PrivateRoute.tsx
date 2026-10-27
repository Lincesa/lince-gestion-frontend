import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { getUserProfile } from '@/auth/profile';
import { useAppDispatch, useAppSelector } from '@/store';
import { setUser } from '@/store/auth/authSlice';
import { ModuleKey } from '@/types';
import { resolveFieldJailRedirect } from './fieldJail';

export function PrivateRoute() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();

  // The stored user can be stale: an admin may have changed its area or modules since login.
  useEffect(() => {
    if (!isAuthenticated) return;
    authApi
      .me()
      .then((fresh) => dispatch(setUser(fresh)))
      .catch(() => {
        // The API client already clears the session when it cannot refresh it.
      });
  }, [isAuthenticated, dispatch]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const redirect = resolveFieldJailRedirect({
    profile: getUserProfile(user),
    pathname: location.pathname,
    mustChangePassword: user?.mustChangePassword,
    logisticsRole: user?.modules?.[ModuleKey.LOGISTICA]?.role,
  });
  if (redirect) return <Navigate to={redirect} replace />;

  return <Outlet />;
}
