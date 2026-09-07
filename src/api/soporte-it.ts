import { api } from './client';
import type {
  Equipo,
  EquipoAsignacion,
  Incidente,
  Relevamiento,
  CreateEquipoPayload,
  UpdateEquipoPayload,
  CreateIncidentePayload,
  UpdateIncidentePayload,
  CreateRelevamientoPayload,
  UpdateRelevamientoPayload,
} from '@/types/soporte-it.types';

const BASE = '/soporte-it';

export const soporteItApi = {
  // Equipos
  getEquipos: () => api.get<Equipo[]>(`${BASE}/equipos`),
  getMisEquipos: () => api.get<Equipo[]>(`${BASE}/equipos/mis-equipos`),
  getEquipo: (id: string) => api.get<Equipo>(`${BASE}/equipos/${id}`),
  createEquipo: (payload: CreateEquipoPayload) =>
    api.post<Equipo>(`${BASE}/equipos`, payload),
  updateEquipo: (id: string, payload: UpdateEquipoPayload) =>
    api.patch<Equipo>(`${BASE}/equipos/${id}`, payload),
  deleteEquipo: (id: string) => api.delete<void>(`${BASE}/equipos/${id}`),
  getEquipoAsignaciones: (id: string) =>
    api.get<EquipoAsignacion[]>(`${BASE}/equipos/${id}/asignaciones`),
  assignEquipo: (id: string, payload: { usuarioPlatId: string; motivo?: string }) =>
    api.post<Equipo>(`${BASE}/equipos/${id}/assign`, payload),
  unassignEquipo: (id: string, payload: { motivo?: string } = {}) =>
    api.post<Equipo>(`${BASE}/equipos/${id}/unassign`, payload),

  // Incidentes
  getIncidentes: () => api.get<Incidente[]>(`${BASE}/incidentes`),
  getMisIncidentes: () => api.get<Incidente[]>(`${BASE}/incidentes/mis-incidentes`),
  getIncidentesByEquipo: (equipoId: string) =>
    api.get<Incidente[]>(`${BASE}/incidentes/equipo/${equipoId}`),
  getIncidente: (id: string) => api.get<Incidente>(`${BASE}/incidentes/${id}`),
  createIncidente: (payload: CreateIncidentePayload) =>
    api.post<Incidente>(`${BASE}/incidentes`, payload),
  updateIncidenteEstado: (id: string, payload: UpdateIncidentePayload) =>
    api.patch<Incidente>(`${BASE}/incidentes/${id}`, payload),
  deleteIncidente: (id: string) => api.delete<void>(`${BASE}/incidentes/${id}`),

  // Relevamientos
  getRelevamiento: (id: string) =>
    api.get<Relevamiento>(`${BASE}/relevamientos/${id}`),
  getRelevamientoByIncidente: (incidenteId: string) =>
    api.get<Relevamiento | null>(`${BASE}/relevamientos/incidente/${incidenteId}`),
  createRelevamiento: (payload: CreateRelevamientoPayload) =>
    api.post<Relevamiento>(`${BASE}/relevamientos`, payload),
  updateRelevamiento: (id: string, payload: UpdateRelevamientoPayload) =>
    api.patch<Relevamiento>(`${BASE}/relevamientos/${id}`, payload),
};
