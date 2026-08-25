export type RemitoSortPreset = '' | 'remito-desc' | 'remito-asc';

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
  page?: number;
  limit?: number;
}

export interface RemitoFilterOptions {
  ptoVentas: string[];
  choferes: string[];
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
    || filters.dateTo,
  );
}

export const EMPTY_REMITO_FILTERS: RemitosFilterValues = {
  page: 1,
  limit: 20,
};
