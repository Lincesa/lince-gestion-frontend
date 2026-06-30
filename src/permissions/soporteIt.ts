import { GlobalRole, ModuleKey, type AuthUser } from '@/types';

export function isSoporteItAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.globalRole === GlobalRole.SUPERADMIN) return true;

  const permission = user.modules[ModuleKey.SOPORTE_IT];
  return permission?.enabled === true && permission.role === 'ADMIN';
}
