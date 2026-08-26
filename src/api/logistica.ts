import { api, API_BASE_URL, getAccessToken } from './client';
import type { GeoLayer, GeoPoint, PaginatedRemitos, RemitoDetalle, RemitoLogistica } from '@/types/logistica.types';

const BASE = '/logistica/remitos';

export interface ListRemitosParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  nroRemito?: string;
  status?: string;
  uploadedByEmail?: string;
  ptoVenta?: string;
  chofer?: string;
  sortBy?: 'createdAt' | 'nroRemito';
  sortOrder?: 'ASC' | 'DESC';
}

export interface MapaRemitosParams {
  dateFrom?: string;
  dateTo?: string;
  uploadedByEmail?: string;
  cliente?: string;
}

export interface ReplaceUploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface ConfirmReplaceResponse {
  documentId: string;
  viewUrl: string | null;
  fileHash: string;
}

export const logisticaApi = {
  listRemitos: (params: ListRemitosParams = {}) => {
    const qs = new URLSearchParams();
    if (params.page)      qs.set('page',      String(params.page));
    if (params.limit)     qs.set('limit',     String(params.limit));
    if (params.dateFrom)  qs.set('dateFrom',  params.dateFrom);
    if (params.dateTo)    qs.set('dateTo',    params.dateTo);
    if (params.nroRemito) qs.set('nroRemito', params.nroRemito);
    if (params.status)          qs.set('status',          params.status);
    if (params.uploadedByEmail) qs.set('uploadedByEmail', params.uploadedByEmail);
    if (params.ptoVenta)        qs.set('ptoVenta',        params.ptoVenta);
    if (params.chofer)          qs.set('chofer',          params.chofer);
    if (params.sortBy)          qs.set('sortBy',          params.sortBy);
    if (params.sortOrder)       qs.set('sortOrder',       params.sortOrder);
    const query = qs.toString();
    return api.get<PaginatedRemitos>(`${BASE}${query ? `?${query}` : ''}`);
  },

  getRemitoFilterOptions: () =>
    api.get<{
      ptoVentas: string[];
      choferes: string[];
      uploaders: { email: string; label: string }[];
    }>(`${BASE}/filter-options`),

  exportRemitos: async (params: ListRemitosParams = {}): Promise<{ blob: Blob; filename: string }> => {
    const qs = new URLSearchParams();
    if (params.dateFrom)        qs.set('dateFrom',        params.dateFrom);
    if (params.dateTo)          qs.set('dateTo',          params.dateTo);
    if (params.nroRemito)       qs.set('nroRemito',       params.nroRemito);
    if (params.status)          qs.set('status',          params.status);
    if (params.uploadedByEmail) qs.set('uploadedByEmail', params.uploadedByEmail);
    if (params.ptoVenta)        qs.set('ptoVenta',        params.ptoVenta);
    if (params.chofer)          qs.set('chofer',          params.chofer);
    if (params.sortBy)          qs.set('sortBy',          params.sortBy);
    if (params.sortOrder)       qs.set('sortOrder',       params.sortOrder);
    const query = qs.toString();
    const res = await fetch(`${API_BASE_URL}${BASE}/export${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Error al exportar' }));
      const raw = (error as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join(' · ') : (raw ?? `Error ${res.status}`);
      throw new Error(message);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    return { blob, filename: match?.[1] ?? 'remitos.csv' };
  },

  getMapaRemitos: (params: MapaRemitosParams = {}) => {
    const qs = new URLSearchParams();
    if (params.dateFrom)        qs.set('dateFrom',        params.dateFrom);
    if (params.dateTo)          qs.set('dateTo',          params.dateTo);
    if (params.uploadedByEmail) qs.set('uploadedByEmail', params.uploadedByEmail);
    if (params.cliente)         qs.set('cliente',         params.cliente);
    const query = qs.toString();
    return api.get<RemitoLogistica[]>(`${BASE}/mapa${query ? `?${query}` : ''}`);
  },

  getRemito: (id: string) => api.get<RemitoDetalle>(`${BASE}/${id}`),

  getViewUrl: (id: string) => api.get<{ url: string }>(`${BASE}/${id}/view-url`),

  /** URL de descarga — el backend sirve el archivo con Content-Disposition */
  getFileUrl: (id: string) => `${API_BASE_URL}${BASE}/${id}/file`,

  downloadRemitoFile: async (id: string): Promise<Blob> => {
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
  },

  requestReplaceUploadUrl: (
    id: string,
    contentType: 'image/jpeg' | 'image/png' | 'image/webp',
  ) => api.post<ReplaceUploadUrlResponse>(`${BASE}/${id}/replace-upload-url`, { contentType }),

  confirmReplace: (id: string) =>
    api.post<ConfirmReplaceResponse>(`${BASE}/${id}/confirm-replace`, {}),

  deleteRemito: (id: string) => api.delete<{ deleted: boolean }>(`${BASE}/${id}`),

  getGeoLayers: () => api.get<GeoLayer[]>('/logistica/geo-layers'),

  createGeoPoint: (data: Omit<GeoPoint, 'id' | 'orden' | 'createdAt' | 'updatedAt'>) =>
    api.post<GeoPoint>('/logistica/geo-layers', data),

  updateGeoPoint: (id: string, data: Partial<Omit<GeoPoint, 'id' | 'orden' | 'createdAt' | 'updatedAt'>>) =>
    api.patch<GeoPoint>(`/logistica/geo-layers/${id}`, data),

  deleteGeoPoint: (id: string) => api.delete<void>(`/logistica/geo-layers/${id}`),
};
