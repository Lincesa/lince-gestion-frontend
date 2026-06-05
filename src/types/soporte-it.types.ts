export type EstadoEquipo = 'activo' | 'en_reparacion' | 'baja';
export type UrgenciaIncidente = 'baja' | 'media' | 'alta';
export type EstadoIncidente = 'pending' | 'in_progress' | 'resolved';

export interface UsuarioPlatResumen {
  id: string;
  name: string;
  email: string;
}

export interface Equipo {
  id: string;
  numeroActivo: number | null;
  aCargoDe: string | null;
  sector: string | null;
  hostname: string | null;
  windowsUserId: string | null;
  fabricante: string | null;
  modelo: string | null;
  ramGb: string | null;
  sistemaOperativo: string | null;
  procesador: string | null;
  firmwareUefi: string | null;
  graficos: string | null;
  almacenamiento: string | null;
  adaptadorRed: string | null;
  ipv6: string | null;
  controladorUsbHost: string | null;
  estado: EstadoEquipo;
  notas: string | null;
  usuarioPlatId: string | null;
  usuarioPlat: UsuarioPlatResumen | null;
  createdAt: string;
  updatedAt: string;
}

export interface RelevamientoItem {
  id: string;
  relevamientoId: string;
  orden: number;
  titulo: string;
  procedimiento: string | null;
  observacion: string | null;
  conclusion: string | null;
}

export interface Relevamiento {
  id: string;
  incidenteId: string;
  creadoPorId: string | null;
  creadoPor: UsuarioPlatResumen | null;
  fecha: string;
  modalidad: string | null;
  conclusionGeneral: string | null;
  pasosASeguir: string | null;
  recomendaciones: string | null;
  items: RelevamientoItem[];
  createdAt: string;
  updatedAt: string;
}

export interface EquipoResumen {
  id: string;
  hostname: string | null;
  fabricante: string | null;
  modelo: string | null;
  sector: string | null;
  aCargoDe: string | null;
  estado: EstadoEquipo;
}

export interface Incidente {
  id: string;
  numeroReporte: number;
  equipoId: string;
  equipo: EquipoResumen;
  reportadoPorId: string | null;
  reportadoPor: UsuarioPlatResumen | null;
  descripcion: string;
  urgencia: UrgenciaIncidente;
  estado: EstadoIncidente;
  fechaReporte: string;
  aplicacionesAfectadas: string | null;
  accionesPrevias: string | null;
  relevamiento: Relevamiento | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEquipoPayload {
  numeroActivo?: number;
  aCargoDe?: string;
  sector?: string;
  hostname?: string;
  windowsUserId?: string;
  fabricante?: string;
  modelo?: string;
  ramGb?: string;
  sistemaOperativo?: string;
  procesador?: string;
  firmwareUefi?: string;
  graficos?: string;
  almacenamiento?: string;
  adaptadorRed?: string;
  ipv6?: string;
  controladorUsbHost?: string;
  estado?: EstadoEquipo;
  notas?: string;
  usuarioPlatId?: string | null;
}

export type UpdateEquipoPayload = Partial<CreateEquipoPayload>;

export interface CreateIncidentePayload {
  equipoId: string;
  descripcion: string;
  urgencia?: UrgenciaIncidente;
  fechaReporte?: string;
  aplicacionesAfectadas?: string;
  accionesPrevias?: string;
}

export interface UpdateIncidentePayload {
  estado?: EstadoIncidente;
  reportadoPorId?: string;
}

export interface RelevamientoItemPayload {
  id?: string;
  orden: number;
  titulo: string;
  procedimiento?: string;
  observacion?: string;
  conclusion?: string;
}

export interface CreateRelevamientoPayload {
  incidenteId: string;
  fecha?: string;
  modalidad?: string;
  conclusionGeneral?: string;
  pasosASeguir?: string;
  recomendaciones?: string;
  items?: RelevamientoItemPayload[];
}

export interface UpdateRelevamientoPayload {
  fecha?: string;
  modalidad?: string;
  conclusionGeneral?: string;
  pasosASeguir?: string;
  recomendaciones?: string;
  items?: RelevamientoItemPayload[];
}
