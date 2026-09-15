import type { AuthUser, LoginResponse, TokenPair } from '@/types';
import { api, apiFetch } from './client';

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),

  logout: () => api.post<void>('/auth/logout', {}),

  me: () => api.get<AuthUser>('/auth/me'),

  refresh: (refreshToken: string) =>
    apiFetch<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/auth/change-password', { currentPassword, newPassword }),
};
