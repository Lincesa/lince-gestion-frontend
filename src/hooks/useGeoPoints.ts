import { useEffect, useState } from 'react';
import { logisticaApi } from '@/api/logistica';
import type { GeoPoint } from '@/types/logistica.types';

// Reference points (plants, clients, depots) change rarely: one request per session.
let cached: Promise<GeoPoint[]> | null = null;

function loadGeoPoints(): Promise<GeoPoint[]> {
  if (!cached) {
    cached = logisticaApi
      .getGeoLayers()
      .then((layers) => layers.flatMap((layer) => layer.points))
      .catch(() => {
        // Users without the Logística module get a 403: no references, but retry next mount.
        cached = null;
        return [];
      });
  }
  return cached;
}

/** Points loaded in the map's geo layers; empty when unavailable. */
export function useGeoPoints(enabled: boolean): { points: GeoPoint[]; loading: boolean } {
  const [state, setState] = useState<{ points: GeoPoint[]; loading: boolean }>({ points: [], loading: enabled });

  useEffect(() => {
    if (!enabled) {
      setState({ points: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    void loadGeoPoints().then((points) => {
      if (!cancelled) setState({ points, loading: false });
    });
    return () => { cancelled = true; };
  }, [enabled]);

  return state;
}
