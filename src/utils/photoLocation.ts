import type { GeoPoint } from '@/types/logistica.types';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface NearestGeoPoint {
  point: GeoPoint;
  meters: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** True when the photo carries a usable GPS fix (0,0 is a GPS with no signal). */
export function hasLocation(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return !(lat === 0 && lng === 0);
}

/** Great-circle distance (haversine), in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestGeoPoint(from: LatLng, points: GeoPoint[]): NearestGeoPoint | null {
  let best: NearestGeoPoint | null = null;
  for (const point of points) {
    const meters = distanceMeters(from, point);
    if (!best || meters < best.meters) best = { point, meters };
  }
  return best;
}

const KM_FORMAT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** "350 m" up close, "12,4 km" further, whole km past 100 km. */
export function formatDistance(meters: number): string {
  // Round first so 999.6 m reads "1 km", not "1000 m".
  const rounded = Math.round(meters);
  if (rounded < 1000) return `${rounded} m`;
  const km = meters / 1000;
  return `${km >= 100 ? Math.round(km) : KM_FORMAT.format(Math.round(km * 10) / 10)} km`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
