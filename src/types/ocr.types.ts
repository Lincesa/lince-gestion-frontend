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
  createdAt:        string;
  updatedAt:        string;
  /** Presigned GET URL incluida en findOne() — expira en 1h */
  viewUrl?:         string | null;
}

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
  page?:             number;
  limit?:            number;
}
