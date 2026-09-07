export interface RemitoLogistica {
  id: string;
  status: string;
  uploadedByName: string;
  uploadedByEmail: string;
  /** Nombre auto-declarado del chofer que subió el remito desde la app mobile. */
  driverName: string | null;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  nroRemito: string | null;
  fecha: string | null;
  cliente: string | null;
}

export interface RemitoDetalle extends RemitoLogistica {
  producto: string | null;
  toneladas: string | null;
  camion: string | null;
  chofer: string | null;
  lugarEntrega: string | null;
  observaciones: string | null;
  viewUrl: string;
  isPdf: boolean;
}

export interface PaginatedRemitos {
  items: RemitoLogistica[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface GeoPoint {
  id: string;
  carpeta: string;
  nombre: string;
  descripcion: string | null;
  lat: number;
  lng: number;
  iconFile: string;
  orden: number;
}

export interface GeoLayer {
  carpeta: string;
  iconFile: string;
  points: GeoPoint[];
}

export type TransportMemberRole = 'CHOFER' | 'DUENO';

export interface TransportMemberView {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: TransportMemberRole;
  active: boolean;
}

export interface TransportView {
  id: string;
  name: string;
  slug: string;
  allowedPrefijos: string[];
  active: boolean;
  members: TransportMemberView[];
}

export type FieldUserKind = 'TAG' | 'TRANSPORTE';

export interface FieldUserView {
  id: string;
  email: string;
  name: string;
  area: string;
  active: boolean;
  uploadClient: string;
  mustChangePassword: boolean;
  transportId: string | null;
  transportName: string | null;
  memberRole: TransportMemberRole | null;
  memberId: string | null;
}

export interface FieldUserCreateResult extends FieldUserView {
  temporaryPassword: string;
}

export interface FieldUserResetResult {
  id: string;
  temporaryPassword: string;
  mustChangePassword: true;
}
