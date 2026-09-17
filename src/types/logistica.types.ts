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

export type TripStatus = 'PLANIFICADO' | 'EN_CURSO' | 'CERRADO' | 'CANCELADO';

export interface TripDriverView {
  id: string;
  userId: string;
  name: string;
  email: string;
}

export interface TripView {
  id: string;
  transportId: string;
  transportName: string;
  origin: string;
  destination: string;
  scheduledAt: string;
  status: TripStatus;
  notes: string | null;
  drivers: TripDriverView[];
  remitosCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTripPayload {
  transportId: string;
  origin: string;
  destination: string;
  scheduledAt: string;
  notes?: string;
  driverIds?: string[];
}

export interface UpdateTripPayload {
  transportId?: string;
  origin?: string;
  destination?: string;
  scheduledAt?: string;
  notes?: string | null;
}

export interface MyTransportView extends TransportView {
  currentMember?: TransportMemberView;
  memberRole?: TransportMemberRole;
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

export type VehicleKind = 'camion' | 'batea' | 'otro';
export type ComplianceSubject = 'TRANSPORT' | 'PERSON' | 'VEHICLE';
export type ComplianceCadence = 'once' | 'monthly' | 'annual' | 'custom';
export type ComplianceStatus = 'missing' | 'ok' | 'expiring' | 'expired';
export type ComplianceReviewStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface VehicleView {
  id: string;
  transportId: string;
  plate: string;
  label: string | null;
  kind: VehicleKind | null;
  active: boolean;
}

export interface ComplianceDocTypeView {
  key: string;
  label: string;
  subject: ComplianceSubject;
  cadence: ComplianceCadence;
  defaultAlertDays: number;
  areaHint: string | null;
  sort: number;
}

export interface ComplianceFileView {
  id: string;
  transportId: string;
  typeKey: string;
  dniSide?: 'front' | 'back' | null;
  subjectUserId: string | null;
  subjectUserName: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  expiresAt: string | null;
  contentType: string;
  originalName: string | null;
  uploadedBy: string;
  uploadedByName: string | null;
  reviewStatus: ComplianceReviewStatus;
  notes: string | null;
  confirmedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  status: Exclude<ComplianceStatus, 'missing'>;
}

export interface ComplianceSlotView {
  typeKey: string;
  label: string;
  subject: ComplianceSubject;
  cadence: ComplianceCadence;
  defaultAlertDays: number;
  subjectUserId: string | null;
  vehicleId: string | null;
  status: ComplianceStatus;
  expiresAt: string | null;
  files: ComplianceFileView[];
}

export interface ComplianceMemberView {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: TransportMemberRole;
}

export interface ComplianceSummary {
  transportId: string;
  types: ComplianceDocTypeView[];
  vehicles: VehicleView[];
  members: ComplianceMemberView[];
  slots: ComplianceSlotView[];
}

export interface ComplianceUploadUrlResponse {
  fileId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}
