/**
 * Pure routing decision for field-user jail (TAG / TRANSPORTE).
 * Kept separate so PrivateRoute stays thin and tests don't need Redux.
 */
import { isFieldArea } from '@/auth/fieldArea';

export function resolveFieldJailRedirect(opts: {
  area: string | null | undefined;
  pathname: string;
  mustChangePassword?: boolean;
  logisticsRole?: string | null;
}): string | null {
  if (opts.mustChangePassword && opts.pathname !== '/change-password') {
    return '/change-password';
  }
  if (!isFieldArea(opts.area) || opts.pathname === '/change-password') return null;
  if (opts.logisticsRole === 'ADMIN') return null;

  const commonPaths = ['/ocr/remitos', '/perfil'];
  const transportPaths = ['/logistica/viajes', '/logistica/mi-transporte'];
  const allowed = [
    ...commonPaths,
    ...(opts.area?.toUpperCase() === 'TRANSPORTE' ? transportPaths : []),
  ];
  if (!allowed.some((path) => opts.pathname === path || opts.pathname.startsWith(`${path}/`))) {
    return opts.area?.toUpperCase() === 'TRANSPORTE' ? '/logistica/viajes' : '/ocr/remitos';
  }
  return null;
}
