import { useAppSelector } from '@/store';
import { GlobalRole, ModuleKey } from '@/types/auth.types';

const ROLE_HIERARCHY = ['VIEWER', 'EDITOR', 'ADMIN'];

function hasRoleOrAbove(userRole: string | undefined, required: string): boolean {
  const ui = ROLE_HIERARCHY.indexOf(userRole ?? '');
  const ri = ROLE_HIERARCHY.indexOf(required);
  if (ri === -1) return false;
  return (ui === -1 ? 0 : ui) >= ri;
}

export function useCanPerform(moduleKey: ModuleKey) {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return { canView: false, canEdit: false, canAdmin: false };

  if (user.globalRole === GlobalRole.SUPERADMIN) {
    return { canView: true, canEdit: true, canAdmin: true };
  }

  const perm = user.modules[moduleKey];
  const canView = perm?.enabled === true;

  return {
    canView,
    canEdit:  canView && hasRoleOrAbove(perm?.role, 'EDITOR'),
    canAdmin: canView && hasRoleOrAbove(perm?.role, 'ADMIN'),
  };
}
