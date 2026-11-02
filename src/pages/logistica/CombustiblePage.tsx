import { useEffect, useState } from 'react';
import { MapPin, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logisticaApi, type ListFuelLoadsParams } from '@/api/logistica';
import { useAppSelector } from '@/store';
import { GlobalRole } from '@/types/auth.types';
import { FilePreviewModal } from '@/pages/ocr/components/FilePreviewModal';
import type { FuelLoadView, PaginatedFuelLoads, VehicleView } from '@/types/logistica.types';

const PAGE_SIZE = 20;

const fieldClass =
  'rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export type FuelLoadsFilters = Omit<ListFuelLoadsParams, 'limit'>;

/** Request params for the current filters; a truck only makes sense within a transport. */
export function fuelLoadsQuery(filters: FuelLoadsFilters): ListFuelLoadsParams {
  const query: ListFuelLoadsParams = { page: filters.page ?? 1, limit: PAGE_SIZE };
  if (filters.transportId) {
    query.transportId = filters.transportId;
    if (filters.vehicleId) query.vehicleId = filters.vehicleId;
  }
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;
  return query;
}

function mapsUrl(load: FuelLoadView): string | null {
  if (load.latitude == null || load.longitude == null) return null;
  return `https://www.google.com/maps?q=${load.latitude},${load.longitude}`;
}

function truckLabel(load: FuelLoadView): string {
  if (!load.vehiclePlate) return '—';
  return load.vehicleLabel ? `${load.vehiclePlate} · ${load.vehicleLabel}` : load.vehiclePlate;
}

function Thumbnail({ url, alt, onOpen }: { url: string | null; alt: string; onOpen: (url: string) => void }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="block h-12 w-12 overflow-hidden rounded border border-border hover:ring-2 hover:ring-ring"
      title={`Ver ${alt.toLowerCase()}`}
    >
      <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </button>
  );
}

/** Deleting a fuel load is reserved to the superadmin. */
export function canDeleteFuelLoads(user: { globalRole: GlobalRole } | null | undefined): boolean {
  return user?.globalRole === GlobalRole.SUPERADMIN;
}

export function FuelLoadsTable({
  items,
  onPreview,
  onDelete,
}: {
  items: FuelLoadView[];
  onPreview: (url: string) => void;
  /** Shows a delete button per row when given. */
  onDelete?: (load: FuelLoadView) => void;
}) {
  const th = 'px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap';
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={th}>Fecha</th>
            <th className={th}>Transporte</th>
            <th className={th}>Chofer</th>
            <th className={th}>Camión</th>
            <th className={`${th} text-right`}>Litros</th>
            <th className={`${th} text-right`}>Km</th>
            <th className={th}>Lugar</th>
            <th className={th}>Ticket</th>
            <th className={th}>Odómetro</th>
            {onDelete && <th className={th} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={onDelete ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">
                No hay cargas de combustible
              </td>
            </tr>
          ) : (
            items.map((load) => {
              const map = mapsUrl(load);
              return (
                <tr key={load.id}>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(load.loadedAt).toLocaleString('es-AR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">{load.transportName}</td>
                  <td className="px-4 py-3">{load.driverName}</td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{truckLabel(load)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {load.liters.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {load.odometerKm != null ? load.odometerKm.toLocaleString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {load.placeNote && <span>{load.placeNote}</span>}
                      {map && (
                        <a
                          href={map}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <MapPin className="h-3 w-3" /> Ver en mapa
                        </a>
                      )}
                      {!load.placeNote && !map && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Thumbnail url={load.ticketUrl} alt="Ticket" onOpen={onPreview} />
                  </td>
                  <td className="px-4 py-3">
                    <Thumbnail url={load.odometerUrl} alt="Odómetro" onOpen={onPreview} />
                  </td>
                  {onDelete && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(load)}
                        aria-label="Eliminar carga"
                        title="Eliminar carga"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CombustiblePage() {
  const [filters, setFilters] = useState<FuelLoadsFilters>({ page: 1 });
  const [data, setData] = useState<PaginatedFuelLoads | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transports, setTransports] = useState<Array<{ id: string; name: string }>>([]);
  const [vehicles, setVehicles] = useState<VehicleView[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canDelete = canDeleteFuelLoads(useAppSelector((s) => s.auth.user));

  useEffect(() => {
    logisticaApi.listComplianceTransports().then(setTransports).catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.transportId) {
      setVehicles([]);
      return;
    }
    let cancelled = false;
    logisticaApi
      .listVehicles(filters.transportId)
      .then((list) => { if (!cancelled) setVehicles(list); })
      .catch(() => { if (!cancelled) setVehicles([]); });
    return () => { cancelled = true; };
  }, [filters.transportId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    logisticaApi
      .listFuelLoads(fuelLoadsQuery(filters))
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'No se pudieron cargar las cargas de combustible');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  // Any filter change goes back to the first page.
  const patch = (next: Partial<FuelLoadsFilters>) => setFilters((f) => ({ ...f, ...next, page: 1 }));
  const setPage = (page: number) => setFilters((f) => ({ ...f, page }));

  const handleDelete = async (load: FuelLoadView) => {
    const when = new Date(load.loadedAt).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const liters = load.liters.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    if (!window.confirm(`¿Eliminar la carga de ${liters} L de ${load.driverName ?? 'chofer sin nombre'} del ${when}? También se borran sus fotos.`)) {
      return;
    }
    try {
      await logisticaApi.deleteFuelLoad(load.id);
      toast.success('Carga de combustible eliminada');
      setFilters((f) => ({ ...f }));
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo eliminar la carga');
    }
  };

  const page = filters.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) : 1;
  const hasFilters = Boolean(filters.transportId || filters.dateFrom || filters.dateTo);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Combustible</h2>
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} en total</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Transporte
          <select
            className={fieldClass}
            value={filters.transportId ?? ''}
            onChange={(e) => patch({ transportId: e.target.value || undefined, vehicleId: undefined })}
          >
            <option value="">Todos</option>
            {transports.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        {filters.transportId && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Camión
            <select
              className={fieldClass}
              value={filters.vehicleId ?? ''}
              onChange={(e) => patch({ vehicleId: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label ? `${v.plate} · ${v.label}` : v.plate}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Desde
          <input
            type="date"
            className={fieldClass}
            value={filters.dateFrom ?? ''}
            onChange={(e) => patch({ dateFrom: e.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hasta
          <input
            type="date"
            className={fieldClass}
            value={filters.dateTo ?? ''}
            onChange={(e) => patch({ dateTo: e.target.value || undefined })}
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters({ page: 1 })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {!loading && !error && <FuelLoadsTable
          items={data?.items ?? []}
          onPreview={setPreviewUrl}
          onDelete={canDelete ? (load) => void handleDelete(load) : undefined}
        />}

      {!loading && pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Read-only preview: without documentId the modal offers no rotation save. */}
      {previewUrl && (
        <FilePreviewModal url={previewUrl} isPdf={false} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}
