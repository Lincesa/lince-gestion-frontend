export enum GlobalRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
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
  area?: string | null;
  globalRole: GlobalRole;
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
