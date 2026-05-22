import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import { icon as leafletIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchMapaRemitos, fetchRemitoDetalle } from '@/store/logistica/remitosSlice';
import { RemitoSidebar } from '@/components/logistica/RemitoSidebar';
import type { RemitoLogistica } from '@/types/logistica.types';

// Leaflet default marker fix for bundlers
const DEFAULT_ICON = leafletIcon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

// Argentina center as default view
const DEFAULT_CENTER: [number, number] = [-34.6, -64.0];
const DEFAULT_ZOOM = 5;

function getMapCenter(items: RemitoLogistica[]): [number, number] {
  if (!items.length) return DEFAULT_CENTER;
  const lats = items.map((r) => r.latitude!);
  const lngs = items.map((r) => r.longitude!);
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  ];
}

export function MapaPage() {
  const dispatch                    = useAppDispatch();
  const { mapaItems, mapaLoading }  = useAppSelector((s) => s.remitosLogistica);

  useEffect(() => {
    void dispatch(fetchMapaRemitos());
  }, [dispatch]);

  const handleMarkerClick = (id: string) => {
    void dispatch(fetchRemitoDetalle(id));
  };

  const center = getMapCenter(mapaItems);

  return (
    <div className="relative h-full w-full" style={{ minHeight: '500px' }}>
      {mapaLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {!mapaLoading && mapaItems.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            No hay remitos con datos de ubicación
          </p>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        style={{ height: '100%', width: '100%', minHeight: '500px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapaItems.map((remito) => (
          <Marker
            key={remito.id}
            position={[remito.latitude!, remito.longitude!]}
            icon={DEFAULT_ICON}
            eventHandlers={{
              click: () => handleMarkerClick(remito.id),
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -41]}>
              <span className="text-xs font-medium">{remito.uploadedByName}</span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      <RemitoSidebar />
    </div>
  );
}
