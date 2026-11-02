import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const patch = vi.fn();
vi.mock('./client', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
  API_BASE_URL: 'http://api.test',
  apiFetch: vi.fn(),
  getAccessToken: () => null,
}));

const { logisticaApi } = await import('./logistica');

describe('fuel loads API', () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset();
  });

  it('lists fuel loads without filters', async () => {
    await logisticaApi.listFuelLoads();
    expect(get).toHaveBeenCalledWith('/logistica/fuel-loads');
  });

  it('sends every filter in the list query', async () => {
    await logisticaApi.listFuelLoads({
      page: 2,
      limit: 50,
      transportId: 't-1',
      vehicleId: 'v-1',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });
    expect(get).toHaveBeenCalledWith(
      '/logistica/fuel-loads?page=2&limit=50&transportId=t-1&vehicleId=v-1&dateFrom=2026-11-01&dateTo=2026-11-30',
    );
  });

  it('toggles the fuel loads flag of a transport', async () => {
    await logisticaApi.setTransportFuelLoads('t-1', true);
    expect(patch).toHaveBeenCalledWith('/logistica/transports/t-1', { fuelLoadsEnabled: true });

    await logisticaApi.setTransportFuelLoads('t-1', false);
    expect(patch).toHaveBeenLastCalledWith('/logistica/transports/t-1', { fuelLoadsEnabled: false });
  });

  it('keeps the transport update payload unchanged', async () => {
    await logisticaApi.updateTransport('t-1', { name: 'Lince', allowedPrefijos: ['TTE1'], active: true });
    expect(patch).toHaveBeenCalledWith('/logistica/transports/t-1', {
      name: 'Lince',
      allowedPrefijos: ['TTE1'],
      active: true,
    });
  });
});
