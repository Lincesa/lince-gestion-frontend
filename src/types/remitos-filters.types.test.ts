import { describe, expect, it } from 'vitest';
import { hasRemitoExportFilters } from './remitos-filters.types';

describe('hasRemitoExportFilters', () => {
  it('keeps treating the existing filters as active', () => {
    expect(hasRemitoExportFilters({})).toBe(false);
    expect(hasRemitoExportFilters({ dateFrom: '2026-01-01' })).toBe(true);
  });

  it('counts the OCR presence state and the remito date as filters', () => {
    expect(hasRemitoExportFilters({ presenceState: 'duda' })).toBe(true);
    expect(hasRemitoExportFilters({ remitoDateFrom: '2026-03-01' })).toBe(true);
    expect(hasRemitoExportFilters({ remitoDateTo: '2026-03-31' })).toBe(true);
  });

  it('ignores a presence field picked without a state', () => {
    expect(hasRemitoExportFilters({ presenceField: 'firma' })).toBe(false);
  });
});
