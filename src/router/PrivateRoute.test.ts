import { describe, expect, it } from 'vitest';
import { UserProfile } from '@/types';
import { resolveFieldJailRedirect } from './fieldJail';

describe('field jail while trips are hidden', () => {
  it('lands TRANSPORTE on Mi transporte instead of Viajes', () => {
    expect(
      resolveFieldJailRedirect({ profile: UserProfile.TRANSPORTE, pathname: '/' }),
    ).toBe('/logistica/mi-transporte');
  });

  it('sends TRANSPORTE away from a saved Viajes link', () => {
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        logisticsRole: 'CHOFER',
        pathname: '/logistica/viajes/123',
      }),
    ).toBe('/logistica/mi-transporte');
  });

  it('still lets TRANSPORTE into Mi transporte and remitos', () => {
    expect(
      resolveFieldJailRedirect({ profile: UserProfile.TRANSPORTE, pathname: '/logistica/mi-transporte' }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({ profile: UserProfile.TRANSPORTE, pathname: '/ocr/remitos' }),
    ).toBeNull();
  });
});

describe('PrivateRoute field jail (TRANSPORTE mirrors TAG)', () => {
  it('jails TAG to /ocr/remitos from staff routes', () => {
    expect(
      resolveFieldJailRedirect({ profile: UserProfile.TAG, pathname: '/', mustChangePassword: false }),
    ).toBe('/ocr/remitos');
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TAG,
        pathname: '/logistica/remitos',
        mustChangePassword: false,
      }),
    ).toBe('/ocr/remitos');
  });

  it('envía TRANSPORTE a sus viajes desde rutas de staff', () => {
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        pathname: '/',
        mustChangePassword: false,
        tripsEnabled: true,
      }),
    ).toBe('/logistica/viajes');
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        pathname: '/crm',
        mustChangePassword: false,
        tripsEnabled: true,
      }),
    ).toBe('/logistica/viajes');
  });

  it('permite viajes, remitos y perfil a choferes', () => {
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        logisticsRole: 'CHOFER',
        pathname: '/logistica/viajes/123',
        tripsEnabled: true,
      }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        pathname: '/ocr/remitos',
        mustChangePassword: false,
      }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        logisticsRole: 'CHOFER',
        pathname: '/perfil',
      }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        pathname: '/ocr/remitos/nuevo',
        mustChangePassword: false,
      }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TAG,
        pathname: '/change-password',
        mustChangePassword: true,
      }),
    ).toBeNull();
  });

  it('permite mi transporte a choferes y dueños', () => {
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        logisticsRole: 'DUENO',
        pathname: '/logistica/mi-transporte',
      }),
    ).toBeNull();
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        logisticsRole: 'CHOFER',
        pathname: '/logistica/mi-transporte',
      }),
    ).toBeNull();
  });

  it('deja acceso completo al rol ADMIN', () => {
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        logisticsRole: 'ADMIN',
        pathname: '/admin',
      }),
    ).toBeNull();
  });

  it('forces password change before jail', () => {
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.TRANSPORTE,
        pathname: '/ocr/remitos',
        mustChangePassword: true,
      }),
    ).toBe('/change-password');
  });

  it('does not jail staff', () => {
    expect(
      resolveFieldJailRedirect({
        profile: UserProfile.STAFF,
        pathname: '/',
        mustChangePassword: false,
      }),
    ).toBeNull();
  });
});
