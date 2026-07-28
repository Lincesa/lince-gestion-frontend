import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import { setAccessToken, setTokens, clearAuth } from './store/auth/authSlice';
import { API_BASE_URL, configureApiClient } from './api/client';
import { ThemeToaster } from './components/ui/ThemeToaster';
import { AppRouter } from './router';
import './index.css';

// Wire the Redux store into the API client (avoids circular dependency)
configureApiClient(
  () => store.getState().auth,
  {
    setAccessToken: (token) => store.dispatch(setAccessToken(token)),
    setTokens: (tokens) => store.dispatch(setTokens(tokens)),
    clearAuth: () => store.dispatch(clearAuth()),
  },
);

async function hydrateAccessTokenFromRefresh(): Promise<void> {
  const { refreshToken, accessToken } = store.getState().auth;
  if (!refreshToken || accessToken) return;
  try {
    const r = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!r.ok) {
      store.dispatch(clearAuth());
      return;
    }
    const data = (await r.json()) as { accessToken: string; refreshToken: string };
    store.dispatch(setTokens(data));
  } catch {
    // Sin red no forzamos logout; el primer apiFetch puede reintentar refresh.
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

void hydrateAccessTokenFromRefresh().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <Provider store={store}>
        <AppRouter />
        <ThemeToaster />
      </Provider>
    </StrictMode>,
  );
});
