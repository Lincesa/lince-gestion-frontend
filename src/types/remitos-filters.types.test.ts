import { describe, expect, it } from 'vitest';
import { countActiveRemitoFilters, hasRemitoExportFilters } from './remitos-filters.types';

describe('hasRemitoExportFilters', () => {
  it('keeps treating the existing filters as active', () => {
    expect(hasRemitoExportFilters({})).toBe(false);
    expect(hasRemitoExportFilters({ dateFrom: '2026-01-01' })).toBe(true);
  });

  it('counts the OCR presence state and the remito date as filters', () => {
    expect(hasRemitoExportFilters({ presenceState: 'duda' })).toBe(true);
    expect(hasRemitoExportFilters({ cliente: 'anonima' })).toBe(true);
    expect(hasRemitoExportFilters({ remitoDateFrom: '2026-03-01' })).toBe(true);
    expect(hasRemitoExportFilters({ remitoDateTo: '2026-03-31' })).toBe(true);
  });

  it('ignores a presence field picked without a state', () => {
    expect(hasRemitoExportFilters({ presenceField: 'firma' })).toBe(false);
  });
});

describe('countActiveRemitoFilters', () => {
  it('counts each applied filter, ignoring paging and sort', () => {
    expect(countActiveRemitoFilters({ page: 3, limit: 20, sortBy: 'nroRemito', sortOrder: 'ASC' })).toBe(0);
    expect(countActiveRemitoFilters({
      ptoVenta: '0008,0009',
      presenceField: 'firma',
      presenceState: 'duda',
      remitoDateFrom: '2026-03-01',
      cliente: 'anonima',
    })).toBe(4);
  });
});
