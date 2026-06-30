import { api } from './client';
import type { UserDto, CreateUserPayload, UpdateUserPayload, UsersListParams } from '@/types/user.types';
import type { PaginatedResponse } from '@/types/common.types';
import type { UserModules } from '@/types';

export const usersApi = {
  list(params: UsersListParams = {}): Promise<PaginatedResponse<UserDto>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search?.trim()) query.set('search', params.search.trim());

    const qs = query.toString();
    return api.get<PaginatedResponse<UserDto>>(`/users${qs ? `?${qs}` : ''}`);
  },

  get(id: string): Promise<UserDto> {
    return api.get<UserDto>(`/users/${id}`);
  },

  create(payload: CreateUserPayload): Promise<UserDto> {
    return api.post<UserDto>('/users', payload);
  },

  update(id: string, payload: UpdateUserPayload): Promise<UserDto> {
    return api.patch<UserDto>(`/users/${id}`, payload);
  },

  updateModules(id: string, modules: UserModules): Promise<UserDto> {
    return api.patch<UserDto>(`/users/${id}/modules`, { modules });
  },

  resetPassword(id: string, newPassword: string): Promise<void> {
    return api.patch<void>(`/users/${id}/reset-password`, { newPassword });
  },

  delete(id: string): Promise<void> {
    return api.delete<void>(`/users/${id}`);
  },
};
