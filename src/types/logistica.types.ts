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
  /** Business void flag ("anulado"), independent of the OCR status. */
  annulledAt?: string | null;
  annulledBy?: string | null;
  annulledByName?: string | null;
  annulReason?: string | null;
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
  /** Drivers of this transport can record fuel loads from the app. */
  fuelLoadsEnabled: boolean;
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
export type ComplianceCadence = 'once' | 'monthly' | 'semiannual' | 'annual' | 'custom';
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
  /** The document has a front and a back uploaded as separate files. */
  twoSided: boolean;
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
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
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
  twoSided: boolean;
  subjectUserId: string | null;
  vehicleId: string | null;
  status: ComplianceStatus;
  expiresAt: string | null;
  /** Files counting for the slot that are not approved yet. */
  pendingReview: number;
  files: ComplianceFileView[];
}

export interface ComplianceOverviewRow {
  transportId: string;
  transportName: string;
  subject: ComplianceSubject;
  subjectUserId: string | null;
  vehicleId: string | null;
  role: string | null;
  name: string;
  status: ComplianceStatus;
  nextExpiresAt: string | null;
  counts: Record<ComplianceStatus, number>;
  pendingReview: number;
}

export interface ComplianceOverview {
  rows: ComplianceOverviewRow[];
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

export interface FuelLoadView {
  id: string;
  transportId: string;
  transportName: string;
  driverId: string;
  driverName: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  vehicleLabel: string | null;
  liters: number;
  odometerKm: number | null;
  latitude: number | null;
  longitude: number | null;
  placeNote: string | null;
  /** Null for loads recorded before the app asked (Trello #89). */
  tankFilled: boolean | null;
  notFilledReason: string | null;
  fuelBrand: string | null;
  loadedAt: string;
  createdAt: string;
  ticketUrl: string | null;
  odometerUrl: string | null;
}

export type FuelLoadPhoto = 'ticket' | 'odometer';

export interface PaginatedFuelLoads {
  items: FuelLoadView[];
  total: number;
  page: number;
  limit: number;
}
