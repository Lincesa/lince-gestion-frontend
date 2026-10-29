// Tipos del módulo OCR — espejo del backend (packages/ocr/src/enums.ts + entities)
// Definidos independientemente del backend, siguiendo convención del proyecto.

export enum OcrRole {
  OPERADOR_CAMPO = 'OPERADOR_CAMPO',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  ADMIN          = 'ADMIN',
}

export enum DocumentType {
  REMITO    = 'REMITO',
  FACTURA   = 'FACTURA',
  RETENCION = 'RETENCION',
}

export enum DocumentStatus {
  PENDIENTE          = 'PENDIENTE',
  PROCESANDO         = 'PROCESANDO',
  VALIDO             = 'VALIDO',
  CON_ERRORES        = 'CON_ERRORES',
  REVISION_PENDIENTE = 'REVISION_PENDIENTE',
  REVISADO           = 'REVISADO',
  APROBADO           = 'APROBADO',
  RECHAZADO          = 'RECHAZADO',
}

export interface OcrDocument {
  id:               string;
  type:             DocumentType;
  status:           DocumentStatus;
  uploadedBy:       string;
  uploadedByRole:   OcrRole;
  /** Nombre auto-declarado del chofer que subió el remito desde la app mobile. NULL si no se informó. */
  driverName:       string | null;
  /** Account that uploaded the document (sent by the list endpoints). */
  uploadedByName?:  string | null;
  uploadedByEmail?: string | null;
  /** GPS where the app took the photo; null for PC (TAG) uploads or no signal. */
  latitude?:        number | null;
  longitude?:       number | null;
  s3Key:            string;
  s3ThumbnailKey:   string | null;
  extractedData:    Record<string, string> | null;
  validationErrors: string[] | null;
  correctedBy:      string | null;
  correctedAt:      string | null;
  reviewedBy:       string | null;
  approvedBy:       string | null;
  approvedAt:       string | null;
  rejectReason:     string | null;
  observaciones:    string | null;
  /** Business void flag ("anulado"), independent of the OCR status. */
  annulledAt?:      string | null;
  annulledBy?:      string | null;
  annulledByName?:  string | null;
  annulReason?:     string | null;
  createdAt:        string;
  updatedAt:        string;
  /** Presigned GET URL incluida en findOne() — expira en 1h */
  viewUrl?:         string | null;
}

/** Supporting photo attached to a REMITO (never goes through OCR). Mirrors the backend AttachmentDto. */
export interface OcrAttachment {
  id:          string;
  documentId:  string;
  contentType: string;
  uploadedBy:  string;
  createdAt:   string;
  confirmedAt: string | null;
  /** Presigned URL — expires; refetch the list instead of caching it. */
  viewUrl:     string;
}

/** Comment on a remito, immutable. Mirrors the backend CommentDto. */
export interface RemitoComment {
  id:         string;
  documentId: string;
  body:       string;
  authorId:   string;
  authorName: string;
  createdAt:  string;
}

/** List filter for voided remitos; absent means all. */
export type AnnulledFilter = 'only' | 'exclude';

export interface OcrDocumentStatus {
  id:               string;
  status:           DocumentStatus;
  validationErrors: string[] | null;
  updatedAt:        string;
}

export interface PaginatedDocuments {
  items: OcrDocument[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface UploadUrlResponse {
  documentId: string;
  uploadUrl:  string;
  s3Key:      string;
  expiresIn:  number;
}

export interface OcrConfig {
  type:           DocumentType;
  requiredFields: string[];
  fieldLabels:    Record<string, string>;
  updatedAt:      string;
}

export interface OcrFieldCounts {
  si:   number;
  duda: number;
  no:   number;
}

export interface OcrStats {
  total:      number;
  editados:   number;
  firma:      OcrFieldCounts;
  aclaracion: OcrFieldCounts;
  dni:        OcrFieldCounts;
}

export interface FilterDocumentsParams {
  type?:             DocumentType;
  status?:           DocumentStatus;
  uploadedBy?:       string;
  uploadedByEmail?:  string;
  dateFrom?:         string;
  dateTo?:           string;
  nroRemito?:        string;
  ptoVenta?:         string;
  chofer?:           string;
  cliente?:          string;
  presenceField?:    'firma' | 'aclaracion' | 'dni';
  presenceState?:    'si' | 'duda' | 'no';
  remitoDateFrom?:   string;
  remitoDateTo?:     string;
  annulled?:         AnnulledFilter;
  sortBy?:           'createdAt' | 'nroRemito';
  sortOrder?:        'ASC' | 'DESC';
  page?:             number;
  limit?:            number;
}

export interface RemitoUploaderOption {
  email: string;
  label: string;
}

export interface RemitoFilterOptions {
  ptoVentas: string[];
  choferes:  string[];
  uploaders: RemitoUploaderOption[];
}
