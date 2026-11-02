import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UserProfile } from '@/types';
import type { FuelLoadView, TransportView } from '@/types/logistica.types';
import { resolveFieldJailRedirect } from '@/router/fieldJail';
import { FuelLoadsTable, fuelLoadsQuery } from './CombustiblePage';
import { toggleTransportFuelLoads } from './TransportesPage';

function load(overrides: Partial<FuelLoadView> = {}): FuelLoadView {
  return {
    id: 'load-1',
    transportId: 't-1',
    transportName: 'TTe. LINCE',
    driverId: 'u-1',
    driverName: 'Juan Pérez',
    vehicleId: 'v-1',
    vehiclePlate: 'AB123CD',
    vehicleLabel: 'Scania',
    liters: 152.5,
    odometerKm: 123456,
    latitude: -26.8241,
    longitude: -65.2226,
    placeNote: 'YPF Ruta 9',
    loadedAt: '2026-11-02T13:30:00.000Z',
    createdAt: '2026-11-02T13:31:00.000Z',
    ticketUrl: 'https://s3.test/ticket.jpg',
    odometerUrl: null,
    ...overrides,
  };
}

describe('FuelLoadsTable', () => {
  it('renders liters, truck, driver, place and a maps link when the load has coordinates', () => {
    const html = renderToStaticMarkup(<FuelLoadsTable items={[load()]} onPreview={() => {}} />);
    expect(html).toContain('152,5');
    expect(html).toContain('AB123CD · Scania');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('TTe. LINCE');
    expect(html).toContain('YPF Ruta 9');
    expect(html).toContain('https://www.google.com/maps?q=-26.8241,-65.2226');
    expect(html).toContain('https://s3.test/ticket.jpg');
  });

  it('omits the maps link without coordinates', () => {
    const html = renderToStaticMarkup(
      <FuelLoadsTable items={[load({ latitude: null, longitude: null })]} onPreview={() => {}} />,
    );
    expect(html).toContain('YPF Ruta 9');
    expect(html).not.toContain('google.com/maps');
  });

  it('shows the empty state', () => {
    const html = renderToStaticMarkup(<FuelLoadsTable items={[]} onPreview={() => {}} />);
    expect(html).toContain('No hay cargas de combustible');
  });
});

describe('fuelLoadsQuery', () => {
  it('passes the filters through to the list request', () => {
    expect(fuelLoadsQuery({
      page: 3,
      transportId: 't-1',
      vehicleId: 'v-1',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    })).toEqual({
      page: 3,
      limit: 20,
      transportId: 't-1',
      vehicleId: 'v-1',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });
  });

  it('drops the truck filter when no transport is selected', () => {
    expect(fuelLoadsQuery({ page: 1, vehicleId: 'v-1' })).toEqual({ page: 1, limit: 20 });
  });
});

describe('toggleTransportFuelLoads', () => {
  it('sends the inverted fuelLoadsEnabled flag', async () => {
    const setFlag = vi.fn().mockResolvedValue({});
    const transport = { id: 't-1', fuelLoadsEnabled: false } as TransportView;
    await toggleTransportFuelLoads(transport, setFlag);
    expect(setFlag).toHaveBeenCalledWith('t-1', true);

    await toggleTransportFuelLoads({ ...transport, fuelLoadsEnabled: true }, setFlag);
    expect(setFlag).toHaveBeenLastCalledWith('t-1', false);
  });
});

describe('Combustible route access', () => {
  it('keeps field users out of the office fuel loads page', () => {
    expect(resolveFieldJailRedirect({ profile: UserProfile.TRANSPORTE, pathname: '/logistica/combustible' }))
      .toBe('/logistica/viajes');
    expect(resolveFieldJailRedirect({ profile: UserProfile.TAG, pathname: '/logistica/combustible' }))
      .toBe('/ocr/remitos');
  });
});
