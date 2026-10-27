import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

const STORAGE_KEY = 'lince-auth';

function loadFromStorage(): Partial<AuthState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return {
      user: parsed.user ?? null,
      refreshToken: parsed.refreshToken ?? null,
      isAuthenticated: parsed.isAuthenticated ?? false,
    };
  } catch {
    return {};
  }
}

function saveToStorage(state: AuthState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: state.user,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    );
  } catch {
    // ignore storage errors
  }
}

const persisted = loadFromStorage();

const initialState: AuthState = {
  user: persisted.user ?? null,
  accessToken: null, // access token is ephemeral — never persisted
  refreshToken: persisted.refreshToken ?? null,
  isAuthenticated: persisted.isAuthenticated ?? false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(
      state,
      action: PayloadAction<{ user: AuthUser; accessToken: string; refreshToken: string }>,
    ) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      saveToStorage(state);
    },
    /** Fresh identity from GET /auth/me: permissions change when an admin edits the user or its area. */
    setUser(state, action: PayloadAction<AuthUser>) {
      // A late /auth/me response must not resurrect a closed session, nor overwrite
      // the identity of another user who logged in meanwhile.
      if (!state.isAuthenticated || state.user?.id !== action.payload.id) return;
      state.user = action.payload;
      saveToStorage(state);
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    /** Tras POST /auth/refresh el servidor rota el refresh token; hay que persistir ambos. */
    setTokens(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      saveToStorage(state);
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      saveToStorage(state);
    },
    clearMustChangePassword(state) {
      if (state.user) {
        state.user = { ...state.user, mustChangePassword: false };
        saveToStorage(state);
      }
    },
  },
});

export const { setAuth, setUser, setAccessToken, setTokens, clearAuth, clearMustChangePassword } =
  authSlice.actions;
export default authSlice.reducer;
