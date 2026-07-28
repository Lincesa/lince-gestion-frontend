import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { icon as leafletIcon, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, ChevronUp, Layers, MapPin, Plus, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchMapaRemitos, fetchRemitoDetalle } from '@/store/logistica/remitosSlice';
import {
  fetchGeoLayers,
  openCreatePoint,
  openEditPoint,
  setAllLayersVisible,
  setGeoSearch,
  toggleLayerVisibility,
} from '@/store/logistica/geoLayersSlice';
import { RemitoSidebar } from '@/components/logistica/RemitoSidebar';
import { GeoPointModal } from '@/components/logistica/GeoPointModal';
import { UPLOADER_CHIPS } from '@/constants/uploaderChips';
import type { MapaRemitosParams } from '@/api/logistica';
import type { RemitoLogistica, GeoPoint } from '@/types/logistica.types';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';

// ─── Leaflet icons ────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Panel unificado ──────────────────────────────────────────────────────────

type Tab = 'remitos' | 'capas';

interface ControlPanelProps {
  filters: MapaRemitosParams;
  onFiltersChange: (f: MapaRemitosParams) => void;
  onFlyTo: (lat: number, lng: number) => void;
}

function MapaControlPanel({ filters, onFiltersChange, onFlyTo }: ControlPanelProps) {
  const dispatch = useAppDispatch();
  const { canEdit } = useCanPerform(ModuleKey.LOGISTICA);
  const { layers, visibility, geoSearch } = useAppSelector((s) => s.geoLayers);

  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('capas');
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  const toggleExpanded = (carpeta: string) =>
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      next.has(carpeta) ? next.delete(carpeta) : next.add(carpeta);
      return next;
    });

  // Búsqueda en capas
  const term = geoSearch.trim().toLowerCase();
  const filteredLayers = layers
    .map((layer) => {
      if (!term) return { layer, matchingPoints: layer.points };
      const carpetaMatch = layer.carpeta.toLowerCase().includes(term);
      const matchingPoints = carpetaMatch
        ? layer.points
        : layer.points.filter(
            (p) =>
              p.nombre.toLowerCase().includes(term) ||
              (p.descripcion ?? '').toLowerCase().includes(term),
          );
      if (carpetaMatch || matchingPoints.length > 0) return { layer, matchingPoints };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalPoints = layers.reduce((acc, l) => acc + l.points.length, 0);
  const totalMatching = filteredLayers.reduce((acc, { matchingPoints }) => acc + matchingPoints.length, 0);
  const allVisible = layers.every((l) => visibility[l.carpeta] === true);
  const hasEnabled = layers.some((l) => visibility[l.carpeta] === true);

  const toggleChip = (email: string) =>
    onFiltersChange({ ...filters, uploadedByEmail: filters.uploadedByEmail === email ? undefined : email });

  const hasActiveFilters = filters.uploadedByEmail || filters.dateFrom || filters.dateTo;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'remitos', label: 'Remitos', icon: <MapPin size={13} /> },
    { id: 'capas',   label: 'Capas',   icon: <Layers size={13} /> },
  ];

  return (
    <div
      className="absolute top-3 right-3 z-[900] w-72 rounded-xl border border-border bg-card shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-2.5 select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-sm font-semibold text-foreground">Filtros del mapa</span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>

      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex border-t border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-primary text-primary'
                    : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'remitos' && hasActiveFilters && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                {tab.id === 'capas' && hasEnabled && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Remitos ── */}
          {activeTab === 'remitos' && (
            <div className="divide-y divide-border">
              {/* Chips de uploader */}
              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Uploader</p>
                <div className="flex flex-wrap gap-1.5">
                  {UPLOADER_CHIPS.map((chip) => {
                    const active = filters.uploadedByEmail === chip.email;
                    return (
                      <button
                        key={chip.email}
                        onClick={() => toggleChip(chip.email)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground hover:bg-muted'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fecha */}
              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</p>
                <div className="flex flex-col gap-1.5">
                  <input
                    type="date"
                    value={filters.dateFrom ?? ''}
                    onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="date"
                    value={filters.dateTo ?? ''}
                    onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Limpiar */}
              {hasActiveFilters && (
                <div className="px-4 py-2">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    onClick={() => onFiltersChange({})}
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Capas ── */}
          {activeTab === 'capas' && (
            <>
              {/* Buscador */}
              <div className="px-4 py-3 border-t border-border">
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5">
                  <Search size={12} className="shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar capa o punto…"
                    value={geoSearch}
                    onChange={(e) => dispatch(setGeoSearch(e.target.value))}
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  {geoSearch && (
                    <button
                      onClick={() => dispatch(setGeoSearch(''))}
                      className="shrink-0 text-muted-foreground hover:text-foreground leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Conteo + acciones globales */}
              <div className="flex items-center justify-between border-t border-border px-4 py-1.5">
                <span className="text-xs text-muted-foreground">
                  {term ? `${totalMatching} / ${totalPoints} puntos` : `${totalPoints} puntos`}
                </span>
                <div className="flex gap-3">
                  {!allVisible && (
                    <button className="text-xs text-primary hover:underline" onClick={() => dispatch(setAllLayersVisible(true))}>
                      Ver todas
                    </button>
                  )}
                  {hasEnabled && (
                    <button className="text-xs text-muted-foreground hover:underline" onClick={() => dispatch(setAllLayersVisible(false))}>
                      Ocultar
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de capas */}
              <ul className="max-h-64 overflow-y-auto border-t border-border py-1">
                {filteredLayers.length === 0 ? (
                  <li className="px-4 py-4 text-center text-xs text-muted-foreground">Sin resultados</li>
                ) : (
                  filteredLayers.map(({ layer, matchingPoints }) => {
                    const isVisible = visibility[layer.carpeta] === true;
                    const isExpanded = expandedLayers.has(layer.carpeta) || (!!term && matchingPoints.length > 0);
                    const pointsToShow = term ? matchingPoints : layer.points;

                    return (
                      <li key={layer.carpeta}>
                        {/* Fila de la carpeta */}
                        <div className="flex items-center gap-1 px-3 py-1.5 hover:bg-muted/50">
                          {/* Chevron para expandir */}
                          <button
                            onClick={() => toggleExpanded(layer.carpeta)}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-transform"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
                          >
                            <ChevronDown size={12} />
                          </button>

                          {/* Icono + nombre — click = toggle visibilidad */}
                          <div
                            className="flex flex-1 cursor-pointer items-center gap-2 overflow-hidden"
                            onClick={() => dispatch(toggleLayerVisibility(layer.carpeta))}
                          >
                            <img
                              src={`/geo-icons/${layer.iconFile}`}
                              alt=""
                              className="h-4 w-4 shrink-0 object-contain"
                              style={{ opacity: isVisible ? 1 : 0.35 }}
                            />
                            <span
                              className="flex-1 truncate text-xs font-medium"
                              style={{ opacity: isVisible ? 1 : 0.45 }}
                            >
                              {layer.carpeta}
                            </span>
                          </div>

                          {/* Conteo */}
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {term ? `${matchingPoints.length}/${layer.points.length}` : layer.points.length}
                          </span>

                          {/* Checkbox visibilidad */}
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => dispatch(toggleLayerVisibility(layer.carpeta))}
                            className="h-3 w-3 cursor-pointer accent-primary"
                          />
                        </div>

                        {/* Sub-lista de puntos */}
                        {isExpanded && (
                          <ul className="border-l-2 border-border ml-6 pl-2 py-0.5 mb-0.5">
                            {pointsToShow.map((p) => (
                              <li
                                key={p.id}
                                className="flex cursor-pointer items-start gap-1.5 py-0.5 group"
                                onClick={() => onFlyTo(p.lat, p.lng)}
                                title="Ir al punto"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50 group-hover:bg-primary transition-colors" />
                                <span className="text-xs text-muted-foreground group-hover:text-foreground leading-snug break-words transition-colors">
                                  {p.nombre}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>

              {/* Nuevo punto */}
              {canEdit && (
                <div className="border-t border-border p-3">
                  <button
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    onClick={() => dispatch(openCreatePoint())}
                  >
                    <Plus size={12} />
                    Nuevo punto
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── MapaPage ─────────────────────────────────────────────────────────────────

export function MapaPage() {
  const dispatch                   = useAppDispatch();
  const { canEdit }                = useCanPerform(ModuleKey.LOGISTICA);
  const { mapaItems, mapaLoading } = useAppSelector((s) => s.remitosLogistica);
  const { layers, visibility, geoSearch } = useAppSelector((s) => s.geoLayers);

  const [mapaFilters, setMapaFilters] = useState<MapaRemitosParams>({});
  const mapRef = useRef<LeafletMap | null>(null);

  const flyToPoint = (lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 17, { duration: 1 });
  };

  useEffect(() => {
    void dispatch(fetchMapaRemitos(mapaFilters));
  }, [dispatch, mapaFilters]);

  useEffect(() => {
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

  const visiblePoints = useMemo(() => {
    const term = geoSearch.trim().toLowerCase();
    return layers.flatMap((l) => {
      if (!visibility[l.carpeta]) return [];
      if (!term) return l.points;
      const carpetaMatch = l.carpeta.toLowerCase().includes(term);
      if (carpetaMatch) return l.points;
      return l.points.filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          (p.descripcion ?? '').toLowerCase().includes(term),
      );
    });
  }, [layers, visibility, geoSearch]);

  const center = getMapCenter(mapaItems);

  return (
    <div className="relative h-full w-full" style={{ minHeight: '500px' }}>
      {mapaLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      <MapContainer
        ref={mapRef}
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
            eventHandlers={{ click: () => { dispatch(fetchRemitoDetalle(remito.id)); flyToPoint(remito.latitude!, remito.longitude!); } }}
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
                  {canEdit && (
                    <button
                      className="mt-2 w-full rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      onClick={() => dispatch(openEditPoint(point))}
                    >
                      Editar
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <MapaControlPanel filters={mapaFilters} onFiltersChange={setMapaFilters} onFlyTo={flyToPoint} />
      <RemitoSidebar />
      <GeoPointModal />
    </div>
  );
}
