import { describe, expect, it } from 'vitest';
import { TRIPS_ENABLED, logisticaTabs } from './features';

describe('trips switch', () => {
  it('stays off until the business decides to use trips', () => {
    expect(TRIPS_ENABLED).toBe(false);
  });

  it('drops the Viajes tab while trips are off and keeps it when on', () => {
    const tabs = [
      { to: '/logistica/remitos', label: 'Remitos' },
      { to: '/logistica/viajes', label: 'Viajes' },
      { to: '/logistica/combustible', label: 'Combustible' },
    ];
    expect(logisticaTabs(tabs, false).map((t) => t.label)).toEqual(['Remitos', 'Combustible']);
    expect(logisticaTabs(tabs, true).map((t) => t.label)).toEqual(['Remitos', 'Viajes', 'Combustible']);
  });
});
