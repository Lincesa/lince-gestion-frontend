import { api, API_BASE_URL, getAccessToken } from './client';
import type {
  CreateTripPayload,
  FieldUserCreateResult,
  FieldUserKind,
  FieldUserResetResult,
  FieldUserView,
  GeoLayer,
  GeoPoint,
  PaginatedRemitos,
  RemitoDetalle,
  RemitoLogistica,
  MyTransportView,
  TransportMemberRole,
  TransportView,
  TripView,
  UpdateTripPayload,
  VehicleKind,
  VehicleView,
  ComplianceFileView,
  ComplianceSummary,
  ComplianceUploadUrlResponse,
} from '@/types/logistica.types';

const BASE = '/logistica/remitos';

interface TripApiResponse {
  id: string;
  transportId: string;
  transport?: { id: string; name: string };
  origin: string;
  destination: string;
  scheduledAt: string;
  status: TripView['status'];
  notes: string | null;
  drivers?: Array<{
    id: string;
    userId: string;
    user?: { id: string; name: string; email: string };
  }>;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeTrip(trip: TripApiResponse): TripView {
  return {
    ...trip,
    transportName: trip.transport?.name ?? '',
    drivers: (trip.drivers ?? []).map((driver) => ({
      id: driver.id,
      userId: driver.userId,
      name: driver.user?.name ?? '',
      email: driver.user?.email ?? '',
    })),
  };
}

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

  listTransports: () => api.get<TransportView[]>('/logistica/transports'),

  createTransport: (payload: { name: string; slug?: string; allowedPrefijos?: string[] }) =>
    api.post<TransportView>('/logistica/transports', payload),

  updateTransport: (id: string, payload: { name?: string; allowedPrefijos?: string[]; active?: boolean }) =>
    api.patch<TransportView>(`/logistica/transports/${id}`, payload),

  addTransportMember: (
    transportId: string,
    payload: { name: string; email: string; password: string; role: TransportMemberRole },
  ) => api.post<TransportView>(`/logistica/transports/${transportId}/members`, payload),

  updateTransportMember: (
    transportId: string,
    memberId: string,
    payload: { role?: TransportMemberRole; active?: boolean },
  ) => api.patch<TransportView>(
    `/logistica/transports/${transportId}/members/${memberId}`,
    payload,
  ),

  deleteTransportMember: (transportId: string, memberId: string) =>
    api.delete<TransportView>(`/logistica/transports/${transportId}/members/${memberId}`),

  getMyTransport: () => api.get<MyTransportView>('/logistica/my-transport'),

  listTrips: () =>
    api.get<TripApiResponse[]>('/logistica/trips').then((items) => items.map(normalizeTrip)),

  getTrip: (id: string) =>
    api.get<TripApiResponse>(`/logistica/trips/${id}`).then(normalizeTrip),

  createTrip: async (payload: CreateTripPayload) => {
    const { driverIds = [], ...tripPayload } = payload;
    const trip = await api.post<TripApiResponse>('/logistica/trips', tripPayload);
    if (!driverIds.length) return normalizeTrip(trip);
    const assigned = await api.put<TripApiResponse>(
      `/logistica/trips/${trip.id}/assignments`,
      { userIds: driverIds },
    );
    return normalizeTrip(assigned);
  },

  updateTrip: (id: string, payload: UpdateTripPayload) =>
    api.patch<TripApiResponse>(`/logistica/trips/${id}`, payload).then(normalizeTrip),

  updateTripStatus: (id: string, status: TripView['status']) =>
    api.patch<TripApiResponse>(`/logistica/trips/${id}/state`, { status }).then(normalizeTrip),

  setTripAssignments: (id: string, userIds: string[]) =>
    api.put<TripApiResponse>(`/logistica/trips/${id}/assignments`, { userIds }).then(normalizeTrip),

  listFieldUsers: (kind: FieldUserKind) =>
    api.get<FieldUserView[]>(`/logistica/field-users?kind=${kind}`),

  createFieldUser: (payload: {
    kind: FieldUserKind;
    name: string;
    email: string;
    password: string;
    transportId?: string;
    memberRole?: TransportMemberRole;
  }) => api.post<FieldUserCreateResult>('/logistica/field-users', payload),

  updateFieldUser: (
    userId: string,
    payload: {
      name?: string;
      active?: boolean;
      transportId?: string;
      memberRole?: TransportMemberRole;
    },
  ) => api.patch<FieldUserView>(`/logistica/field-users/${userId}`, payload),

  resetFieldUserPassword: (userId: string, newPassword: string) =>
    api.post<FieldUserResetResult>(`/logistica/field-users/${userId}/reset-password`, {
      newPassword,
    }),

  listComplianceTransports: () =>
    api.get<Array<{ id: string; name: string }>>('/logistica/compliance/transports'),

  listVehicles: (transportId?: string) => {
    const qs = transportId ? `?transportId=${encodeURIComponent(transportId)}` : '';
    return api.get<VehicleView[]>(`/logistica/vehicles${qs}`);
  },

  createVehicle: (payload: {
    transportId?: string;
    plate: string;
    label?: string;
    kind?: VehicleKind;
  }) => api.post<VehicleView>('/logistica/vehicles', payload),

  updateVehicle: (
    id: string,
    payload: Partial<{ plate: string; label: string | null; kind: VehicleKind | null; active: boolean }>,
  ) => api.patch<VehicleView>(`/logistica/vehicles/${id}`, payload),

  getComplianceSummary: (transportId: string) =>
    api.get<ComplianceSummary>(`/logistica/compliance/summary?transportId=${encodeURIComponent(transportId)}`),

  requestComplianceUploadUrl: (payload: {
    transportId: string;
    typeKey: string;
    contentType: string;
    subjectUserId?: string;
    vehicleId?: string;
    originalName?: string;
    expiresAt?: string;
    fileId?: string;
    replaceFileId?: string;
  }) => api.post<ComplianceUploadUrlResponse>('/logistica/compliance/files/upload-url', payload),

  confirmComplianceUpload: (fileId: string) =>
    api.post<ComplianceFileView>('/logistica/compliance/files/confirm-upload', { fileId }),

  getComplianceViewUrl: (fileId: string) =>
    api.get<{ url: string; contentType: string; originalName: string | null }>(
      `/logistica/compliance/files/${fileId}/view-url`,
    ),

  updateComplianceFile: (fileId: string, payload: { expiresAt?: string | null; notes?: string | null }) =>
    api.patch<ComplianceFileView>(`/logistica/compliance/files/${fileId}`, payload),

  deleteComplianceFile: (fileId: string) =>
    api.delete<{ id: string; supersededAt: string }>(`/logistica/compliance/files/${fileId}`),
};
