import type {
  AusenciaEmpleado,
  DiaNoLaborable,
  Planta,
  TipoAusencia,
  TipoExcepcionDia,
} from '@/types';
import { api } from './client';

export interface CreateDiaNoLaborablePayload {
  fecha: string;
  plantas: Planta[];
  motivo: string;
  tipoExcepcion?: TipoExcepcionDia;
}

export type UpdateDiaNoLaborablePayload = Partial<CreateDiaNoLaborablePayload>;

export interface CreateAusenciaPayload {
  empleadoId: string;
  desde: string;
  hasta: string;
  tipo: TipoAusencia;
  motivo?: string | null;
  horasJustificadas?: number | null;
}

export type UpdateAusenciaPayload = Partial<Omit<CreateAusenciaPayload, 'empleadoId'>>;

function buildQs(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const asistenciaCalendarApi = {
  listDiasNoLaborables: (desde?: string, hasta?: string) =>
    api.get<DiaNoLaborable[]>(
      `/asistencia/calendar/no-laborables${buildQs({ desde, hasta })}`,
    ),

  createDiaNoLaborable: (payload: CreateDiaNoLaborablePayload) =>
    api.post<DiaNoLaborable>('/asistencia/calendar/no-laborables', payload),

  updateDiaNoLaborable: (id: string, payload: UpdateDiaNoLaborablePayload) =>
    api.patch<DiaNoLaborable>(`/asistencia/calendar/no-laborables/${id}`, payload),

  deleteDiaNoLaborable: (id: string) =>
    api.delete<void>(`/asistencia/calendar/no-laborables/${id}`),

  listAusencias: (params: { empleadoId?: string; desde?: string; hasta?: string }) =>
    api.get<AusenciaEmpleado[]>(
      `/asistencia/calendar/ausencias${buildQs(params)}`,
    ),

  createAusencia: (payload: CreateAusenciaPayload) =>
    api.post<AusenciaEmpleado>('/asistencia/calendar/ausencias', payload),

  updateAusencia: (id: string, payload: UpdateAusenciaPayload) =>
    api.patch<AusenciaEmpleado>(`/asistencia/calendar/ausencias/${id}`, payload),

  deleteAusencia: (id: string) =>
    api.delete<void>(`/asistencia/calendar/ausencias/${id}`),
};
