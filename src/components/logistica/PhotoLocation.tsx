/**
 * PhotoLocation — where the driver took the remito photo, placed under the
 * remito data so it can be checked at a glance: a mini map, the distance to
 * the closest known point (plant, client, depot) and a jump to Google Maps.
 */
import { lazy, Suspense } from 'react';
import { Copy, ExternalLink, MapPin, MapPinOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatDistance,
  googleMapsUrl,
  hasLocation,
  type NearestGeoPoint,
} from '@/utils/photoLocation';

const PhotoLocationMap = lazy(() => import('./PhotoLocationMap'));

/** Beyond this the closest point is not a meaningful "where": say so instead. */
const NEAR_METERS = 50_000;
/** Close enough to draw both pins and still read the map. */
const SAME_MAP_METERS = 5_000;

interface Props {
  lat:               number | null | undefined;
  lng:               number | null | undefined;
  nearest:           NearestGeoPoint | null;
  referencesLoading: boolean;
  /** The Mapa page already shows a big map; its sidebar only needs the facts. */
  showMap?:          boolean;
}

export function PhotoLocation({ lat, lng, nearest, referencesLoading, showMap = true }: Props) {
  const located = hasLocation(lat, lng);

  return (
    <section className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium text-muted-foreground">Ubicación de la foto</h3>
      </div>

      {!located ? (
        <p className="flex items-start gap-2 py-1 text-xs text-muted-foreground">
          <MapPinOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Esta foto no trae ubicación. Las fotos subidas desde la PC (TAG) o sin señal de GPS no la registran.
        </p>
      ) : (
        <LocatedPhoto
          lat={lat!}
          lng={lng!}
          nearest={nearest}
          referencesLoading={referencesLoading}
          showMap={showMap}
        />
      )}
    </section>
  );
}

function LocatedPhoto({
  lat, lng, nearest, referencesLoading, showMap,
}: { lat: number; lng: number; nearest: NearestGeoPoint | null; referencesLoading: boolean; showMap: boolean }) {
  const coordinates = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const isNear = nearest !== null && nearest.meters <= NEAR_METERS;
  const reference = nearest && nearest.meters <= SAME_MAP_METERS ? nearest.point : null;

  const copyCoordinates = () => {
    if (!navigator.clipboard) {
      toast.error('Este navegador no permite copiar: seleccioná las coordenadas a mano');
      return;
    }
    navigator.clipboard.writeText(coordinates)
      .then(() => toast.success('Coordenadas copiadas'))
      .catch(() => toast.error('No se pudieron copiar las coordenadas'));
  };

  return (
    <div className="space-y-2.5">
      {isNear ? (
        <p className="text-sm text-foreground">
          A <strong className="font-semibold">{formatDistance(nearest.meters)}</strong> de{' '}
          <strong className="font-semibold">{nearest.point.nombre}</strong>
          <span className="text-muted-foreground"> · {nearest.point.carpeta}</span>
        </p>
      ) : nearest ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Lejos de los puntos cargados: el más cercano es {nearest.point.nombre}, a {formatDistance(nearest.meters)}.
        </p>
      ) : referencesLoading ? (
        <p className="text-xs text-muted-foreground">Buscando el punto cargado más cercano…</p>
      ) : null}

      {showMap && (
        <div className="overflow-hidden rounded-md border border-border">
          <Suspense fallback={<div className="h-40 w-full animate-pulse bg-muted" />}>
            <PhotoLocationMap lat={lat} lng={lng} reference={reference} />
          </Suspense>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <a
          href={googleMapsUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir en Google Maps
        </a>
        <button
          type="button"
          onClick={copyCoordinates}
          title="Copiar coordenadas"
          className="inline-flex items-center gap-1.5 rounded-sm font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="h-3 w-3" />
          {coordinates}
        </button>
      </div>
    </div>
  );
}
