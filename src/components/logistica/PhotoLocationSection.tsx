import { useMemo } from 'react';
import { useGeoPoints } from '@/hooks/useGeoPoints';
import { hasLocation, nearestGeoPoint } from '@/utils/photoLocation';
import { PhotoLocation } from './PhotoLocation';

interface Props {
  lat:      number | null | undefined;
  lng:      number | null | undefined;
  showMap?: boolean;
}

/** Container: pairs the photo's GPS with the closest point loaded in the map layers. */
export function PhotoLocationSection({ lat, lng, showMap }: Props) {
  const located = hasLocation(lat, lng);
  const { points, loading } = useGeoPoints(located);
  const nearest = useMemo(
    () => (located ? nearestGeoPoint({ lat: lat!, lng: lng! }, points) : null),
    [located, lat, lng, points],
  );

  return (
    <PhotoLocation lat={lat} lng={lng} nearest={nearest} referencesLoading={loading} showMap={showMap} />
  );
}
