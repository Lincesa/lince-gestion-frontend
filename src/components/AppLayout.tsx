import { Outlet, useNavigate } from 'react-router-dom';
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
  if (isFieldArea(user.area)) return <Outlet />;

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Outlet />
    </Layout>
  );
}
