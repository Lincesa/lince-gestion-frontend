/** Módulo desde el que se opera el panel de tags — determina el prefijo de la API. */
export type TagsModule = 'ocr' | 'logistica';

export interface TagStatusDto {
  id: string;
  email: string;
  name: string;
  tagSuspended: boolean;
  tagSuspendedAt: string | null;
  tagSuspendedReason: string | null;
}

export type TagStatusEventType = 'AUTO_SUSPEND' | 'MANUAL_SUSPEND' | 'MANUAL_REACTIVATE';

export interface TagStatusEventDto {
  id: string;
  eventType: TagStatusEventType;
  triggeredBy: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}
