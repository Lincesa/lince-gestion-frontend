/**
 * Pure routing decision for field-user jail (TAG / TRANSPORTE).
 * Kept separate so PrivateRoute stays thin and tests don't need Redux.
 */
import { isFieldArea } from '@/auth/fieldArea';

export function resolveFieldJailRedirect(opts: {
  area: string | null | undefined;
  pathname: string;
  mustChangePassword?: boolean;
}): string | null {
  if (opts.mustChangePassword && opts.pathname !== '/change-password') {
    return '/change-password';
  }
  if (
    isFieldArea(opts.area) &&
    !opts.pathname.startsWith('/ocr/remitos') &&
    opts.pathname !== '/change-password'
  ) {
    return '/ocr/remitos';
  }
  return null;
}
