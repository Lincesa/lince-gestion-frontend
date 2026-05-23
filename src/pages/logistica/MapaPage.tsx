import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { icon as leafletIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchMapaRemitos, fetchRemitoDetalle } from '@/store/logistica/remitosSlice';
import { fetchGeoLayers, openEditPoint } from '@/store/logistica/geoLayersSlice';
import { RemitoSidebar } from '@/components/logistica/RemitoSidebar';
import { GeoLayersPanel } from '@/components/logistica/GeoLayersPanel';
import { GeoPointModal } from '@/components/logistica/GeoPointModal';
import type { RemitoLogistica, GeoPoint } from '@/types/logistica.types';

const DEFAULT_ICON = leafletIcon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

function buildGeoIcon(iconFile: string) {
  return leafletIcon({
    iconUrl: `/geo-icons/${iconFile}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

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

function formatDesc(desc: string | null): string[] {
  if (!desc) return [];
  return desc.split('\n').map((l) => l.trim()).filter(Boolean);
}

export function MapaPage() {
  const dispatch                   = useAppDispatch();
  const { mapaItems, mapaLoading } = useAppSelector((s) => s.remitosLogistica);
  const { layers, visibility }     = useAppSelector((s) => s.geoLayers);

  useEffect(() => {
    void dispatch(fetchMapaRemitos());
    void dispatch(fetchGeoLayers());
  }, [dispatch]);

  const geoIconCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof leafletIcon>>();
    for (const layer of layers) {
      if (!cache.has(layer.iconFile)) {
        cache.set(layer.iconFile, buildGeoIcon(layer.iconFile));
      }
    }
    return cache;
  }, [layers]);

  const visiblePoints = useMemo(
    () => layers.flatMap((l) => (visibility[l.carpeta] === true ? l.points : [])),
    [layers, visibility],
  );

  const center = getMapCenter(mapaItems);

  return (
    <div className="relative h-full w-full" style={{ minHeight: '500px' }}>
      {mapaLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
            eventHandlers={{ click: () => dispatch(fetchRemitoDetalle(remito.id)) }}
          >
            <Tooltip permanent direction="top" offset={[0, -41]}>
              <span className="text-xs font-medium">{remito.uploadedByName}</span>
            </Tooltip>
          </Marker>
        ))}

        {visiblePoints.map((point: GeoPoint) => {
          const iconFile = layers.find((l) => l.carpeta === point.carpeta)?.iconFile ?? 'icon-1.png';
          const icon = geoIconCache.get(iconFile) ?? buildGeoIcon('icon-1.png');
          const descLines = formatDesc(point.descripcion);

          return (
            <Marker key={point.id} position={[point.lat, point.lng]} icon={icon}>
              <Popup minWidth={200} maxWidth={280}>
                <div className="space-y-1.5 py-0.5">
                  <p className="font-semibold text-sm leading-tight">{point.nombre}</p>
                  <p className="text-xs text-gray-500">{point.carpeta}</p>
                  {descLines.length > 0 && (
                    <div className="border-t pt-1.5 space-y-0.5">
                      {descLines.map((line, i) => (
                        <p key={i} className="text-xs leading-snug text-gray-700 break-words">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    className="mt-2 w-full rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    onClick={() => dispatch(openEditPoint(point))}
                  >
                    Editar
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <GeoLayersPanel />
      <RemitoSidebar />
      <GeoPointModal />
    </div>
  );
}
