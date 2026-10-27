import { describe, expect, it } from 'vitest';
import { GlobalRole, UserProfile, type AuthUser } from '@/types';
import reducer, { setAuth, setUser } from './authSlice';

const stored: AuthUser = {
  id: 'u-1',
  email: 'ana@lincesa.com.ar',
  name: 'Ana',
  area: 'Ventas',
  globalRole: GlobalRole.USER,
  modules: {},
  mustChangePassword: false,
};

describe('authSlice.setUser', () => {
  it('replaces the stored user with the fresh one from /auth/me, keeping the session', () => {
    const loggedIn = reducer(undefined, setAuth({ user: stored, accessToken: 'a', refreshToken: 'r' }));
    const fresh: AuthUser = {
      ...stored,
      profile: UserProfile.STAFF,
      modules: { crm: { enabled: true, role: 'EDITOR' } },
    };

    const next = reducer(loggedIn, setUser(fresh));

    expect(next.user).toEqual(fresh);
    expect(next.accessToken).toBe('a');
    expect(next.refreshToken).toBe('r');
    expect(next.isAuthenticated).toBe(true);
  });
});
