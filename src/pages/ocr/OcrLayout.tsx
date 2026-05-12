import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Camera, FileText, LayoutDashboard, LogOut, Receipt, Settings } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store';
import { clearAuth } from '@/store/auth/authSlice';
import { authApi } from '@/api/auth';
import { GlobalRole } from '@/types';

export function OcrLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const isSuperAdmin = user?.globalRole === GlobalRole.SUPERADMIN;
  const isTag = user?.area?.toUpperCase() === 'TAG';

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      dispatch(clearAuth());
      navigate('/login', { replace: true });
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    ].join(' ');

  if (isTag) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border px-3 sm:px-6 py-2 flex items-center gap-1 overflow-x-auto">
          <NavLink to="/ocr/remitos" className={navClass}>
            <Camera className="h-4 w-4" />
            Cargar remito
          </NavLink>
          <button
            onClick={handleLogout}
            className="ml-auto flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-3 sm:px-6 py-2 flex items-center gap-1 overflow-x-auto">
        <NavLink to="/ocr" end className={navClass}>
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>
        <NavLink to="/ocr/remitos" className={navClass}>
          <Camera className="h-4 w-4" />
          Remitos
        </NavLink>
        <NavLink to="/ocr/facturas" className={navClass}>
          <FileText className="h-4 w-4" />
          Facturas
        </NavLink>
        <NavLink to="/ocr/retenciones" className={navClass}>
          <Receipt className="h-4 w-4" />
          Retenciones
        </NavLink>
        {isSuperAdmin && (
          <NavLink to="/ocr/configuracion" className={navClass}>
            <Settings className="h-4 w-4" />
            Configuración
          </NavLink>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
