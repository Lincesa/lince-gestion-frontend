export type RemitoSortPreset = '' | 'remito-desc' | 'remito-asc';

export type RemitoPresenceField = 'firma' | 'aclaracion' | 'dni';
export type RemitoPresenceState = 'si' | 'duda' | 'no';

export interface RemitosFilterValues {
  ptoVenta?: string;
  chofer?: string;
  uploadedByEmail?: string;
  sortBy?: 'createdAt' | 'nroRemito';
  sortOrder?: 'ASC' | 'DESC';
  nroRemito?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Without a field, presenceState matches any of firma / aclaración / DNI. */
  presenceField?: RemitoPresenceField;
  presenceState?: RemitoPresenceState;
  /** The remito's own date (OCR "fecha"), not the upload date. */
  remitoDateFrom?: string;
  remitoDateTo?: string;
  page?: number;
  limit?: number;
}

export interface RemitoUploaderOption {
  email: string;
  label: string;
}

export interface RemitoFilterOptions {
  ptoVentas: string[];
  choferes: string[];
  uploaders: RemitoUploaderOption[];
}

export function applyRemitoSortPreset(preset: RemitoSortPreset): Pick<RemitosFilterValues, 'sortBy' | 'sortOrder'> {
  if (preset === 'remito-desc') return { sortBy: 'nroRemito', sortOrder: 'DESC' };
  if (preset === 'remito-asc') return { sortBy: 'nroRemito', sortOrder: 'ASC' };
  return { sortBy: undefined, sortOrder: undefined };
}

export function detectRemitoSortPreset(filters: RemitosFilterValues): RemitoSortPreset {
  if (filters.sortBy === 'nroRemito' && filters.sortOrder === 'DESC') return 'remito-desc';
  if (filters.sortBy === 'nroRemito' && filters.sortOrder === 'ASC') return 'remito-asc';
  return '';
}

export function splitRemitoFilterValues(value?: string): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))];
}

export function joinRemitoFilterValues(values: string[]): string | undefined {
  const unique = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  return unique.length ? unique.join(',') : undefined;
}

/** Applied filters, for the collapsed bar's badge. Field + state count as one presence filter. */
export function countActiveRemitoFilters(filters: RemitosFilterValues): number {
  return [
    filters.ptoVenta,
    filters.chofer,
    filters.uploadedByEmail,
    filters.nroRemito,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.presenceState,
    filters.remitoDateFrom,
    filters.remitoDateTo,
  ].filter(Boolean).length;
}

export function hasActiveRemitoFilters(filters: RemitosFilterValues): boolean {
  return hasRemitoExportFilters(filters);
}

export function hasRemitoExportFilters(filters: RemitosFilterValues): boolean {
  return Boolean(
    filters.ptoVenta
    || filters.chofer
    || filters.uploadedByEmail
    || filters.nroRemito
    || filters.status
    || filters.dateFrom
    || filters.dateTo
    || filters.presenceState
    || filters.remitoDateFrom
    || filters.remitoDateTo,
  );
}

export const EMPTY_REMITO_FILTERS: RemitosFilterValues = {
  page: 1,
  limit: 20,
};
