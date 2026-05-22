import type { LucideIcon } from 'lucide-react';
import { ClipboardCheck, FileText, LayoutDashboard, Megaphone, MapPin, Monitor, ScanLine, Settings, Users } from 'lucide-react';
import { GlobalRole, ModuleKey, type AuthUser } from '@/types';

export type DashboardNavKey = 'dashboard' | 'admin';

export interface AppModuleNav {
  key: DashboardNavKey | ModuleKey;
  label: string;
  path: string;
  Icon: LucideIcon;
  requiresModule?: ModuleKey;
  requiresRole?: GlobalRole;
}

export const APP_MODULE_NAV: readonly AppModuleNav[] = [
  { key: 'dashboard', label: 'Inicio', path: '/', Icon: LayoutDashboard },
  {
    key: ModuleKey.CRM,
    label: 'CRM',
    path: '/crm',
    Icon: Users,
    requiresModule: ModuleKey.CRM,
  },
  {
    key: ModuleKey.CONCILIACIONES,
    label: 'Conciliaciones',
    path: '/conciliaciones',
    Icon: FileText,
    requiresModule: ModuleKey.CONCILIACIONES,
  },
  {
    key: ModuleKey.OCR,
    label: 'OCR',
    path: '/ocr',
    Icon: ScanLine,
    requiresModule: ModuleKey.OCR,
  },
  {
    key: ModuleKey.MARKETING,
    label: 'Marketing',
    path: '/marketing',
    Icon: Megaphone,
    requiresModule: ModuleKey.MARKETING,
  },
  {
    key: ModuleKey.SOPORTE_IT,
    label: 'Soporte IT',
    path: '/soporte-it',
    Icon: Monitor,
    requiresModule: ModuleKey.SOPORTE_IT,
  },
  {
    key: ModuleKey.ASISTENCIA,
    label: 'RRHH',
    path: '/rrhh',
    Icon: ClipboardCheck,
    requiresModule: ModuleKey.ASISTENCIA,
  },
  {
    key: ModuleKey.LOGISTICA,
    label: 'Logística',
    path: '/logistica',
    Icon: MapPin,
    requiresModule: ModuleKey.LOGISTICA,
  },
  {
    key: 'admin',
    label: 'Admin',
    path: '/admin',
    Icon: Settings,
    requiresRole: GlobalRole.SUPERADMIN,
  },
];

export function isNavItemVisible(entry: AppModuleNav, user: AuthUser): boolean {
  if (entry.key === 'dashboard') return true;
  if (entry.requiresRole) return user.globalRole === entry.requiresRole;
  if (!entry.requiresModule) return true;
  // SUPERADMIN ve todos los módulos (igual que el backend siempre lo deja pasar)
  if (user.globalRole === GlobalRole.SUPERADMIN) return true;
  if (entry.requiresModule === ModuleKey.SOPORTE_IT) return true;
  return user.modules[entry.requiresModule]?.enabled === true;
}

export function enabledToolNavEntries(
  user: AuthUser,
): (AppModuleNav & { requiresModule: ModuleKey })[] {
  return APP_MODULE_NAV.filter(
    (e): e is AppModuleNav & { requiresModule: ModuleKey } =>
      e.requiresModule !== undefined && isNavItemVisible(e, user),
  );
}
