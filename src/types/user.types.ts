import { GlobalRole, UserModules } from './auth.types';

export interface AreaDto {
  id: string;
  name: string;
  modules: UserModules;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAreaPayload {
  name: string;
  modules?: UserModules;
}

export interface UpdateAreaPayload {
  name?: string;
  modules?: UserModules;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  modules: UserModules;
  active: boolean;
  area?: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  globalRole?: GlobalRole;
  area?: string;
  modules?: UserModules;
}

export interface UpdateUserPayload {
  name?: string;
  globalRole?: GlobalRole;
  area?: string | null;
  active?: boolean;
}

export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
}
