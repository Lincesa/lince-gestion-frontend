import { NavLink, Outlet } from 'react-router-dom';
import { Camera, LayoutDashboard, Settings, Tag } from 'lucide-react';
import { useAppSelector } from '@/store';
import { GlobalRole, ModuleKey } from '@/types';
import { isFieldArea } from '@/auth/fieldArea';

export function OcrLayout() {
  const user = useAppSelector((s) => s.auth.user);

  const isSuperAdmin = user?.globalRole === GlobalRole.SUPERADMIN;
  const isField = isFieldArea(user?.area);
  const isOcrAdmin = user?.modules?.[ModuleKey.OCR]?.role === 'ADMIN';

  const navClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    ].join(' ');

  if (isField) {
    return <Outlet />;
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
        {/* Facturas y retenciones pausadas temporalmente en el front. */}
        {isSuperAdmin && (
          <NavLink to="/ocr/configuracion" className={navClass}>
            <Settings className="h-4 w-4" />
            Configuración
          </NavLink>
        )}
        {(isSuperAdmin || isOcrAdmin) && (
          <NavLink to="/ocr/tags" className={navClass}>
            <Tag className="h-4 w-4" />
            Tags
          </NavLink>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
