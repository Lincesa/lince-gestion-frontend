import { describe, expect, it } from 'vitest';
import { resolveFieldJailRedirect } from './fieldJail';

describe('PrivateRoute field jail (TRANSPORTE mirrors TAG)', () => {
  it('jails TAG to /ocr/remitos from staff routes', () => {
    expect(
      resolveFieldJailRedirect({ area: 'TAG', pathname: '/', mustChangePassword: false }),
    ).toBe('/ocr/remitos');
    expect(
      resolveFieldJailRedirect({
        area: 'TAG',
        pathname: '/logistica/remitos',
        mustChangePassword: false,
      }),
    ).toBe('/ocr/remitos');
  });

  it('jails TRANSPORTE to /ocr/remitos from staff routes', () => {
    expect(
      resolveFieldJailRedirect({
        area: 'TRANSPORTE',
        pathname: '/',
        mustChangePassword: false,
      }),
    ).toBe('/ocr/remitos');
    expect(
      resolveFieldJailRedirect({
        area: 'transporte',
        pathname: '/crm',
        mustChangePassword: false,
      }),
    ).toBe('/ocr/remitos');
  });

  it('allows field users on /ocr/remitos and change-password', () => {
    expect(
      resolveFieldJailRedirect({
        area: 'TRANSPORTE',
        pathname: '/ocr/remitos',
        mustChangePassword: false,
      }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({
        area: 'TRANSPORTE',
        pathname: '/ocr/remitos/nuevo',
        mustChangePassword: false,
      }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({
        area: 'TAG',
        pathname: '/change-password',
        mustChangePassword: true,
      }),
    ).toBeNull();
  });

  it('forces password change before jail', () => {
    expect(
      resolveFieldJailRedirect({
        area: 'TRANSPORTE',
        pathname: '/ocr/remitos',
        mustChangePassword: true,
      }),
    ).toBe('/change-password');
  });

  it('does not jail staff', () => {
    expect(
      resolveFieldJailRedirect({
        area: 'OPERACIONES',
        pathname: '/',
        mustChangePassword: false,
      }),
    ).toBeNull();
  });
});
