/**
 * Static mini map for one remito photo. Loaded lazily so Leaflet only ships
 * to views that actually show a location.
 */
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import { icon as leafletIcon, latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '@/types/logistica.types';

const PHOTO_ICON = leafletIcon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  shadowSize:  [41, 41],
});

interface Props {
  lat:        number;
  lng:        number;
  /** Shown next to the photo pin only when it is close enough to read both at once. */
  reference?: GeoPoint | null;
}

export default function PhotoLocationMap({ lat, lng, reference }: Props) {
  const photo: [number, number] = [lat, lng];
  const bounds = reference
    ? latLngBounds([photo, [reference.lat, reference.lng]]).pad(0.35)
    : null;

  return (
    <MapContainer
      // Leaflet reads center/bounds only on mount: a new photo needs a new map.
      key={`${lat},${lng},${reference?.id ?? ''}`}
      {...(bounds ? { bounds } : { center: photo, zoom: 15 })}
      className="h-40 w-full"
      // A preview, not a workspace: it must not steal the detail panel's scroll.
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {reference && (
        <CircleMarker
          center={[reference.lat, reference.lng]}
          radius={7}
          pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip permanent direction="right" offset={[8, 0]}>
            <span className="text-xs">{reference.nombre}</span>
          </Tooltip>
        </CircleMarker>
      )}
      <Marker position={photo} icon={PHOTO_ICON} />
    </MapContainer>
  );
}
