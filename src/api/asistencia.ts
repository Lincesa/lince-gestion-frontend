import type { EmpleadoAsistencia, FichajeAsistencia, FichajesPage, Planta, PinSummaryRow, ReporteEmpleadoRango } from '@/types';
import { api } from './client';

export interface FichajesQuery {
  page?: number;
  limit?: number;
  planta?: Planta;
  empleadoId?: string;
  pin?: string;
  nombre?: string;
  fecha?: string;
  desde?: string;
  hasta?: string;
  estado?: '' | '0' | '1';
}

export interface UpdateFichajePayload {
  estado?: 0 | 1;
  empleadoId?: string | null;
  tiempo?: string;
}

export interface CreateFichajePayload {
  pin: string;
  planta: Planta;
  estado: 0 | 1;
  tiempo: string;
  empleadoId?: string | null;
}

export interface CreateEmpleadoPayload {
  firstName: string;
  lastName: string;
  pin: string;
  planta: Planta;
  dni?: string;
  activo?: boolean;
  horasEsperadasDia?: number | null;
}

export interface UpdateEmpleadoPayload {
  firstName?: string;
  lastName?: string;
  pin?: string;
  planta?: Planta;
  dni?: string;
  activo?: boolean;
  horasEsperadasDia?: number | null;
}

export const asistenciaApi = {
  getFichajes: async (query: FichajesQuery) => {
    const qs = new URLSearchParams();
    if (query.page) qs.set('page', String(query.page));
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.planta) qs.set('planta', query.planta);
    if (query.empleadoId) qs.set('empleadoId', query.empleadoId);
    if (query.pin) qs.set('pin', query.pin);
    if (query.nombre?.trim()) qs.set('nombre', query.nombre.trim());
    if (query.fecha?.trim()) qs.set('fecha', query.fecha.trim());
    if (query.desde?.trim()) qs.set('desde', query.desde.trim());
    if (query.hasta?.trim()) qs.set('hasta', query.hasta.trim());
    if (query.estado !== undefined && query.estado !== '') qs.set('estado', query.estado);
    return api.get<FichajesPage>(`/asistencia/logs?${qs.toString()}`);
  },

  updateFichaje: (id: string, payload: UpdateFichajePayload) =>
    api.patch<FichajeAsistencia>(`/asistencia/logs/${id}`, payload),

  createFichaje: (payload: CreateFichajePayload) =>
    api.post<FichajeAsistencia>('/asistencia/logs', payload),

  deleteFichaje: (id: string) =>
    api.delete<void>(`/asistencia/logs/${id}`),

  getEmpleados: (planta?: Planta) =>
    api.get<EmpleadoAsistencia[]>(
      planta ? `/asistencia/empleados?planta=${planta}&soloActivos=true` : '/asistencia/empleados?soloActivos=true',
    ),

  getReporteEmpleado: (empleadoId: string, query: { desde: string; hasta: string; horasEsperadasPorDia: number }) => {
    const qs = new URLSearchParams();
    qs.set('desde', query.desde);
    qs.set('hasta', query.hasta);
    qs.set('horasEsperadasPorDia', String(query.horasEsperadasPorDia));
    return api.get<ReporteEmpleadoRango>(`/asistencia/reports/employee/${empleadoId}/range?${qs.toString()}`);
  },

  getPinesSummary: () =>
    api.get<PinSummaryRow[]>('/asistencia/logs/pines-summary'),

  getAllEmpleados: (planta?: Planta) =>
    api.get<EmpleadoAsistencia[]>(
      planta ? `/asistencia/empleados?planta=${planta}` : '/asistencia/empleados',
    ),

  createEmpleado: (payload: CreateEmpleadoPayload) =>
    api.post<EmpleadoAsistencia>('/asistencia/empleados', payload),

  updateEmpleado: (id: string, payload: UpdateEmpleadoPayload) =>
    api.patch<EmpleadoAsistencia>(`/asistencia/empleados/${id}`, payload),

  deleteEmpleado: (id: string) =>
    api.delete<void>(`/asistencia/empleados/${id}`),

  reconcileUnmatched: (limit = 2000) =>
    api.post<{ scanned: number; matched: number }>(`/asistencia/logs/reconcile-unmatched?limit=${limit}`, {}),

  reassignPin: (pin: string, planta: Planta, empleadoId: string | null) =>
    api.post<{ updated: number }>('/asistencia/logs/reassign-pin', { pin, planta, empleadoId }),

  sendDailyReport: (ymd: string) =>
    api.post<{ sent: boolean; ymd: string }>(`/asistencia/reports/send-daily?ymd=${ymd}`, {}),
};
