/**
 * Pure routing decision for field-user jail (TAG / TRANSPORTE).
 * Kept separate so PrivateRoute stays thin and tests don't need Redux.
 */
import { isFieldUser, isTransportUser } from '@/auth/profile';
import type { UserProfile } from '@/types';
import { TRIPS_ENABLED } from '@/config/features';

export function resolveFieldJailRedirect(opts: {
  profile: UserProfile | null | undefined;
  pathname: string;
  mustChangePassword?: boolean;
  logisticsRole?: string | null;
  tripsEnabled?: boolean;
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
  // While trips are hidden, transport users land on Mi transporte.
  const tripsEnabled = opts.tripsEnabled ?? TRIPS_ENABLED;
  const transportHome = tripsEnabled ? '/logistica/viajes' : '/logistica/mi-transporte';
  const transportPaths = [...(tripsEnabled ? ['/logistica/viajes'] : []), '/logistica/mi-transporte'];
  const allowed = [...commonPaths, ...(isTransport ? transportPaths : [])];

  if (!allowed.some((path) => opts.pathname === path || opts.pathname.startsWith(`${path}/`))) {
    return isTransport ? transportHome : '/ocr/remitos';
  }
  return null;
}
