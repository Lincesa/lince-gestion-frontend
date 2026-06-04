import { api, API_BASE_URL, apiFetch, getAccessToken } from './client';
import type {
  FilterDocumentsParams,
  OcrConfig,
  OcrDocument,
  OcrDocumentStatus,
  OcrStats,
  PaginatedDocuments,
  UploadUrlResponse,
} from '@/types/ocr.types';
import { DocumentType } from '@/types/ocr.types';

const BASE = '/ocr/documents';

// ── Upload flow ───────────────────────────────────────────────────────────────

/** Paso 1: solicitar presigned PUT URL al backend */
export function requestUploadUrl(
  type: DocumentType,
  contentType: string,
): Promise<UploadUrlResponse> {
  return api.post<UploadUrlResponse>(`${BASE}/upload-url`, { type, contentType });
}

/**
 * Paso 2: subir el archivo directamente a S3 usando la presigned URL.
 * Este PUT va directo a S3, NO pasa por el backend.
 * No usa apiFetch — no lleva Authorization header de Lince.
 */
export async function uploadToS3(
  presignedUrl: string,
  file: Blob,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            xhr.status === 0
              ? 'Sin conexión con el servidor de almacenamiento. Verificar credenciales AWS S3.'
              : `Error S3 ${xhr.status}: ${xhr.statusText}`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new Error('Error de red al subir a S3. Verificar configuración AWS.'));
    xhr.send(file);
  });
}

export interface ConfirmUploadResponse {
  documentId: string;
  status: string;
  isDuplicate: boolean;
  originalUploadedAt?: string;
}

/** Paso 3: confirmar al backend que el archivo ya está en S3 → dispara OCR */
export function confirmUpload(documentId: string): Promise<ConfirmUploadResponse> {
  return api.post(`${BASE}/confirm-upload`, { documentId });
}

// ── Consultas ─────────────────────────────────────────────────────────────────

/** ADMIN: todos los documentos con filtros */
export function getDocuments(params: FilterDocumentsParams = {}): Promise<PaginatedDocuments> {
  const qs = buildQs(params);
  return api.get<PaginatedDocuments>(`${BASE}${qs}`);
}

/** ADMINISTRATIVO: solo sus facturas */
export function getMyFacturas(params: FilterDocumentsParams = {}): Promise<PaginatedDocuments> {
  const qs = buildQs(params);
  return api.get<PaginatedDocuments>(`${BASE}/facturas${qs}`);
}

/** ADMINISTRATIVO: solo sus retenciones */
export function getMyRetenciones(params: FilterDocumentsParams = {}): Promise<PaginatedDocuments> {
  const qs = buildQs(params);
  return api.get<PaginatedDocuments>(`${BASE}/retenciones${qs}`);
}

/**
 * Probar extracción OCR directamente sobre un archivo sin subirlo a S3.
 * Solo para testing — no persiste nada en DB.
 */
export async function testExtract(
  file: File,
  type: DocumentType,
): Promise<{ fields: Record<string, string> }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  return apiFetch<{ fields: Record<string, string> }>(`${BASE}/test-extract`, {
    method: 'POST',
    body: formData,
  });
}

/** ADMIN: estadísticas de detección por campo, respetando los mismos filtros que getDocuments */
export function getOcrStats(params: FilterDocumentsParams = {}): Promise<OcrStats> {
  const qs = buildQs(params);
  return api.get<OcrStats>(`${BASE}/stats${qs}`);
}

/** ADMIN: cola de documentos pendientes de revisión */
export function getReviewQueue(params: FilterDocumentsParams = {}): Promise<PaginatedDocuments> {
  const qs = buildQs(params);
  return api.get<PaginatedDocuments>(`${BASE}/review-queue${qs}`);
}

/** Detalle de un documento (incluye viewUrl presigned) */
export function getDocument(id: string): Promise<OcrDocument> {
  return api.get<OcrDocument>(`${BASE}/${id}`);
}

/** Obtiene una presigned view URL fresca para el documento (sin traer todo el detalle) */
export function getDocumentViewUrl(id: string): Promise<{ viewUrl: string | null }> {
  return api.get<{ viewUrl: string | null }>(`${BASE}/${id}/view-url`);
}

/** Descarga el archivo original del documento (imagen o PDF) */
export async function downloadDocumentFile(id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}${BASE}/${id}/file`, {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error al descargar' }));
    const raw = (error as { message?: string | string[] }).message;
    const message = Array.isArray(raw) ? raw.join(' · ') : (raw ?? `Error ${res.status}`);
    throw new Error(message);
  }
  return res.blob();
}

/** Polling de estado — liviano, solo devuelve id + status + errores */
export function getDocumentStatus(id: string): Promise<OcrDocumentStatus> {
  return api.get<OcrDocumentStatus>(`${BASE}/${id}/status`);
}

// ── Edición ────────────────────────────────────────────────────────────────────

/** Corregir campos extraídos por OCR */
export function updateDocumentFields(
  id: string,
  extractedData: Record<string, string>,
): Promise<OcrDocument> {
  return api.patch<OcrDocument>(`${BASE}/${id}`, { extractedData });
}

// ── Aprobación / Rechazo ──────────────────────────────────────────────────────

/** ADMIN: aprobar un documento */
export function approveDocument(id: string): Promise<OcrDocument> {
  return api.patch<OcrDocument>(`${BASE}/${id}/approve`, {});
}

/** ADMIN: rechazar un documento con motivo opcional */
export function rejectDocument(id: string, reason?: string): Promise<OcrDocument> {
  return api.patch<OcrDocument>(`${BASE}/${id}/reject`, { reason });
}

/** ADMIN/SUPERADMIN: eliminar un documento (DB + S3) */
export function deleteDocument(id: string): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>(`${BASE}/${id}`);
}

// ── Configuración (SUPERADMIN) ────────────────────────────────────────────────

export function getOcrConfigs(): Promise<OcrConfig[]> {
  return api.get<OcrConfig[]>(`${BASE}/config/all`);
}

export function updateOcrConfig(
  type: DocumentType,
  requiredFields: string[],
  fieldLabels?: Record<string, string>,
): Promise<OcrConfig> {
  return api.patch<OcrConfig>(`${BASE}/config/update`, { type, requiredFields, fieldLabels });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildQs(params: FilterDocumentsParams): string {
  const p = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
}

