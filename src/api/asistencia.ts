import type { EmpleadoAsistencia, FichajeAsistencia, FichajesPage, Planta, ReporteEmpleadoRango } from '@/types';
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
  empleadoId?: string;
  tiempo?: string;
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

};
