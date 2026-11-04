/**
 * Where to go after login: the in-app page that sent the user to /login (an Excel
 * photo link, a bookmark), or home. Only same-origin paths, never `//host` or a URL.
 */
export function loginDestination(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/';
  // Browsers read `/\host` as `//host`.
  if (from.includes('\\')) return '/';
  if (from === '/login' || from.startsWith('/login?')) return '/';
  return from;
}
