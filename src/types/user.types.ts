import { GlobalRole, UserModules, UserProfile } from './auth.types';

export interface AreaDto {
  id: string;
  name: string;
  modules: UserModules;
  /** Users assigned to the area; an area with users cannot be deleted. */
  userCount: number;
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
  profile: UserProfile;
  /** The user's own modules (extras on top of the area). */
  modules: UserModules;
  /** What the user can actually access: area modules + extras. */
  effectiveModules: UserModules;
  active: boolean;
  areaId: string | null;
  /** Area name, for display. */
  area: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  globalRole?: GlobalRole;
  profile?: UserProfile;
  areaId?: string | null;
  modules?: UserModules;
}

export interface UpdateUserPayload {
  name?: string;
  globalRole?: GlobalRole;
  profile?: UserProfile;
  areaId?: string | null;
  active?: boolean;
}

export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Omitted lists every profile. */
  profile?: UserProfile;
}
