import { describe, expect, it, vi } from 'vitest';
import type { TransportMemberView } from '@/types/logistica.types';
import { resetMemberPassword } from './TransportesPage';

const member = { id: 'm-1', userId: 'u-1', email: 'chofer@lincesa.com.ar', name: 'Chofer', role: 'CHOFER', active: true } as TransportMemberView;

describe('resetMemberPassword', () => {
  it('resets the member account (not the membership) and returns the temporary password', async () => {
    const reset = vi.fn().mockResolvedValue({ id: 'u-1', temporaryPassword: 'Nueva12345', mustChangePassword: true });
    await expect(resetMemberPassword(member, '  Nueva12345 ', reset)).resolves.toBe('Nueva12345');
    expect(reset).toHaveBeenCalledWith('u-1', 'Nueva12345');
  });

  it('rejects a password shorter than 8 characters without calling the API', async () => {
    const reset = vi.fn();
    await expect(resetMemberPassword(member, 'corta', reset)).rejects.toThrow('La contraseña debe tener al menos 8 caracteres');
    expect(reset).not.toHaveBeenCalled();
  });
});
