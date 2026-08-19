/** Módulo desde el que se opera el panel de tags — determina el prefijo de la API. */
export type TagsModule = 'ocr' | 'logistica';

/** Por qué vía sube documentos una cuenta. Solo WATCHER se auto-suspende. */
export type UploadClient = 'WATCHER' | 'MOBILE' | 'WEB';

export interface TagStatusDto {
  id: string;
  email: string;
  name: string;
  tagSuspended: boolean;
  tagSuspendedAt: string | null;
  tagSuspendedReason: string | null;
  uploadClient: UploadClient;
}

export type TagStatusEventType = 'AUTO_SUSPEND' | 'MANUAL_SUSPEND' | 'MANUAL_REACTIVATE';

export interface TagStatusEventDto {
  id: string;
  eventType: TagStatusEventType;
  triggeredBy: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}
