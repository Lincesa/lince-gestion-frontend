import { api, API_BASE_URL } from './client';
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
    const query = qs.toString();
    return api.get<PaginatedRemitos>(`${BASE}${query ? `?${query}` : ''}`);
  },

  getMapaRemitos: () => api.get<RemitoLogistica[]>(`${BASE}/mapa`),

  getRemito: (id: string) => api.get<RemitoDetalle>(`${BASE}/${id}`),

  getViewUrl: (id: string) => api.get<{ url: string }>(`${BASE}/${id}/view-url`),

  /** URL de descarga — el backend redirige 302 a S3 presigned URL */
  getFileUrl: (id: string) => `${API_BASE_URL}${BASE}/${id}/file`,

  getGeoLayers: () => api.get<GeoLayer[]>('/logistica/geo-layers'),

  createGeoPoint: (data: Omit<GeoPoint, 'id' | 'orden' | 'createdAt' | 'updatedAt'>) =>
    api.post<GeoPoint>('/logistica/geo-layers', data),

  updateGeoPoint: (id: string, data: Partial<Omit<GeoPoint, 'id' | 'orden' | 'createdAt' | 'updatedAt'>>) =>
    api.patch<GeoPoint>(`/logistica/geo-layers/${id}`, data),

  deleteGeoPoint: (id: string) => api.delete<void>(`/logistica/geo-layers/${id}`),
};
