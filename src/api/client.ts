// Auth state is injected from the Redux store after initialization
// to avoid circular dependencies (store → slices → thunks → client → store).
type AuthGetter = () => { accessToken: string | null; refreshToken: string | null };
type AuthActions = {
  setAccessToken: (token: string) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clearAuth: () => void;
};

let _getAuth: AuthGetter = () => ({ accessToken: null, refreshToken: null });
let _authActions: AuthActions = {
  setAccessToken: () => {},
  setTokens: () => {},
  clearAuth: () => {},
};

// Singleton refresh: evita que requests paralelas hagan múltiples refresh simultáneos
let _refreshPromise: Promise<string | null> | null = null;

/** Call this once after creating the Redux store, in main.tsx */
export function configureApiClient(getAuth: AuthGetter, actions: AuthActions) {
  _getAuth = getAuth;
  _authActions = actions;
}

function apiBaseUrl(): string {
  const raw = (import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
  if (raw.endsWith('/api')) return raw;
  return `${raw}/api`;
}

export const API_BASE_URL = apiBaseUrl();
const BASE_URL = API_BASE_URL;

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { accessToken, refreshToken } = _getAuth();

  const headers = new Headers(options.headers ?? {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const pathNorm = path.startsWith('/') ? path : `/${path}`;
  const url = `${BASE_URL}${pathNorm}`;
  let res = await fetch(url, { ...options, headers });

  // Access token expired → try refresh (singleton para evitar múltiples refreshes paralelos)
  if (res.status === 401 && !options.skipAuth && refreshToken) {
    if (!_refreshPromise) {
      _refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
        .then(async (r) => {
          if (!r.ok) return null;
          const data = (await r.json()) as { accessToken: string; refreshToken: string };
          _authActions.setTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          return data.accessToken;
        })
        .finally(() => { _refreshPromise = null; });
    }

    const newToken = await _refreshPromise;
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    } else {
      _authActions.clearAuth();
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error desconocido' }));
    const raw = (error as { message?: string | string[] }).message;
    const message = Array.isArray(raw) ? raw.join(' · ') : (raw ?? `Error ${res.status}`);
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Returns the current access token for raw fetch calls (file downloads, etc.) */
export function getAccessToken(): string | null {
  return _getAuth().accessToken;
}

export const api = {
  get: <T>(path: string, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'GET', ...opts }),
  post: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  patch: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  delete: <T>(path: string, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'DELETE', ...opts }),
};
