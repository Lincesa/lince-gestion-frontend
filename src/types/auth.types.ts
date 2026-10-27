export enum GlobalRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

/** Access profile, independent from the organizational area. TAG/TRANSPORTE are field accounts. */
export enum UserProfile {
  STAFF = 'STAFF',
  TAG = 'TAG',
  TRANSPORTE = 'TRANSPORTE',
}

export enum ModuleKey {
  CRM = 'crm',
  CONCILIACIONES = 'conciliaciones',
  OCR = 'ocr',
  MARKETING = 'marketing',
  SOPORTE_IT = 'soporte-it',
  ASISTENCIA = 'asistencia',
  LOGISTICA = 'logistica',
}

export interface ModulePermission {
  enabled: boolean;
  role: string;
}

export type UserModules = Partial<Record<ModuleKey, ModulePermission>>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** Area name (for field users the backend reports the profile here, for mobile compatibility). */
  area?: string | null;
  areaId?: string | null;
  /** Missing in sessions stored before profiles existed; use getUserProfile(). */
  profile?: UserProfile;
  globalRole: GlobalRole;
  /** Effective permissions: area modules + the user's own extras. */
  modules: UserModules;
  mustChangePassword: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  user: AuthUser;
}
