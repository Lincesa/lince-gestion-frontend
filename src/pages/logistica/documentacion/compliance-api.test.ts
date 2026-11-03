import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('@/api/client', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
  API_BASE_URL: 'http://api.test',
  apiFetch: vi.fn(),
  getAccessToken: () => null,
}));

const { logisticaApi } = await import('@/api/logistica');

describe('compliance review API', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
  });

  it('approves a file by id', async () => {
    await logisticaApi.approveComplianceFile('file-1');
    expect(post).toHaveBeenCalledWith('/logistica/compliance/files/file-1/approve', {});
  });

  it('updates a type cadence and alert days', async () => {
    await logisticaApi.updateComplianceType('carnet', { cadence: 'semiannual', defaultAlertDays: 15 });
    expect(patch).toHaveBeenCalledWith('/logistica/compliance/types/carnet', { cadence: 'semiannual', defaultAlertDays: 15 });
  });

  it('reads the overview and the types', async () => {
    await logisticaApi.getComplianceOverview();
    await logisticaApi.listComplianceTypes();
    expect(get).toHaveBeenCalledWith('/logistica/compliance/overview');
    expect(get).toHaveBeenCalledWith('/logistica/compliance/types');
  });
});
