import { describe, expect, it } from 'vitest';
import {
  distanceMeters,
  formatDistance,
  googleMapsUrl,
  hasLocation,
  nearestGeoPoint,
} from './photoLocation';
import type { GeoPoint } from '@/types/logistica.types';

function point(nombre: string, lat: number, lng: number): GeoPoint {
  return { id: nombre, carpeta: 'Plantas', nombre, descripcion: null, lat, lng, iconFile: 'planta.png', orden: 0 };
}

// San Miguel de Tucumán (Plaza Independencia) and two references around it.
const PLAZA = { lat: -26.8303, lng: -65.2038 };
const CERCA = point('Planta Centro', -26.8330, -65.2038); // ~300 m south
const LEJOS = point('Planta Salta', -24.7859, -65.4117); // ~228 km north

describe('ubicación de la foto del remito', () => {
  it('mide la distancia real entre dos puntos (haversine)', () => {
    expect(distanceMeters(PLAZA, CERCA)).toBeGreaterThan(280);
    expect(distanceMeters(PLAZA, CERCA)).toBeLessThan(320);
    expect(distanceMeters(PLAZA, PLAZA)).toBe(0);
  });

  it('elige el punto cargado más cercano y su distancia', () => {
    const result = nearestGeoPoint(PLAZA, [LEJOS, CERCA]);
    expect(result?.point.nombre).toBe('Planta Centro');
    expect(result?.meters).toBeGreaterThan(280);
    expect(result?.meters).toBeLessThan(320);
  });

  it('sin puntos cargados no hay referencia', () => {
    expect(nearestGeoPoint(PLAZA, [])).toBeNull();
  });

  it('muestra metros cerca y kilómetros lejos, en formato argentino', () => {
    expect(formatDistance(42)).toBe('42 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1 km');
    expect(formatDistance(12_440)).toBe('12,4 km');
    expect(formatDistance(228_310)).toBe('228 km');
  });

  it('arma el link de Google Maps con las coordenadas exactas', () => {
    expect(googleMapsUrl(-26.8303, -65.2038)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-26.8303%2C-65.2038',
    );
  });

  it('una foto sin GPS no tiene ubicación (null o 0,0 de un GPS sin señal)', () => {
    expect(hasLocation(-26.83, -65.2)).toBe(true);
    expect(hasLocation(null, -65.2)).toBe(false);
    expect(hasLocation(undefined, undefined)).toBe(false);
    expect(hasLocation(0, 0)).toBe(false);
  });
});
