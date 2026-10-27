/**
 * Pure routing decision for field-user jail (TAG / TRANSPORTE).
 * Kept separate so PrivateRoute stays thin and tests don't need Redux.
 */
import { isFieldUser, isTransportUser } from '@/auth/profile';
import type { UserProfile } from '@/types';

export function resolveFieldJailRedirect(opts: {
  profile: UserProfile | null | undefined;
  pathname: string;
  mustChangePassword?: boolean;
  logisticsRole?: string | null;
}): string | null {
  if (opts.mustChangePassword && opts.pathname !== '/change-password') {
    return '/change-password';
  }
  const profile = { profile: opts.profile ?? undefined };
  const isTransport = isTransportUser(profile);
  const isField = isFieldUser(profile);
  if (!isField || opts.pathname === '/change-password') return null;
  if (opts.logisticsRole === 'ADMIN') return null;

  const commonPaths = ['/ocr/remitos', '/perfil'];
  const transportPaths = ['/logistica/viajes', '/logistica/mi-transporte'];
  const allowed = [...commonPaths, ...(isTransport ? transportPaths : [])];

  if (!allowed.some((path) => opts.pathname === path || opts.pathname.startsWith(`${path}/`))) {
    return isTransport ? '/logistica/viajes' : '/ocr/remitos';
  }
  return null;
}
