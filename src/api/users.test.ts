import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfile } from '@/types';

const get = vi.fn();
vi.mock('./client', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

const { usersApi } = await import('./users');

describe('usersApi.list', () => {
  beforeEach(() => get.mockReset());

  it('filters by profile when one is given', async () => {
    await usersApi.list({ page: 2, profile: UserProfile.TRANSPORTE });
    expect(get).toHaveBeenCalledWith('/users?page=2&profile=TRANSPORTE');
  });

  it('sends no profile filter when none is given', async () => {
    await usersApi.list({ search: 'ana' });
    expect(get).toHaveBeenCalledWith('/users?search=ana');
  });
});
