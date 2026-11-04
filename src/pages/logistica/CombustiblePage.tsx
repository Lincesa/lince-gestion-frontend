import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, MapPin, Pencil, Plus, RotateCcw, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { logisticaApi, type ListFuelLoadsParams } from '@/api/logistica';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useCanPerform } from '@/hooks/useCanPerform';
import { useAppSelector } from '@/store';
import { GlobalRole, ModuleKey } from '@/types/auth.types';
import { FilePreviewModal } from '@/pages/ocr/components/FilePreviewModal';
import type { FuelLoadPhoto, FuelLoadView, PaginatedFuelLoads, VehicleView } from '@/types/logistica.types';

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

/** Km as typed by the office: digits, optionally with thousands dots. Anything else is invalid. */
export function parseKm(text: string): number | null {
  const digits = text.trim().replace(/\./g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/**
 * Excel date serial in the viewer's local time. SheetJS' own Date conversion is off by
 * the 1899 local-mean-time offset in Argentina (20:53 comes out as 20:52).
 */
export function excelSerial(date: Date): number {
  return (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000 + 25_569;
}

const SHEET_DATE_FORMAT = 'dd/mm/yyyy hh:mm';

/** Web route that opens a photo after login; the Excel report links here. */
export function fuelLoadPhotoPath(id: string, photo: FuelLoadPhoto): string {
  return `/logistica/combustible/${id}/foto/${photo}`;
}

const REPORT_HEADER = [
  'Marca temporal', 'Chofer', 'Transporte', 'Patente', 'Fecha', 'Litros',
  '¿Se llenó?', 'Motivo', 'Bandera', 'Km tacómetro', 'Lugar', 'Foto ticket', 'Foto tacómetro',
];
const REPORT_WIDTHS = [18, 22, 18, 12, 18, 10, 10, 28, 12, 14, 28, 14, 16];
const TICKET_COL = 11;
const ODOMETER_COL = 12;

/** SI / NO, or blank for loads recorded before the app asked. */
function tankFilledLabel(load: FuelLoadView): string | null {
  if (load.tankFilled == null) return null;
  return load.tankFilled ? 'SI' : 'NO';
}

/**
 * The report in the column order of the old Google Form sheet. Numbers and dates stay
 * numbers so the indicators dashboard can use them; photo cells link to the web app.
 */
export function buildFuelLoadsSheet(items: FuelLoadView[], origin: string): XLSX.WorkSheet {
  const body = items.map((load) => [
    excelSerial(new Date(load.createdAt)),
    load.driverName ?? null,
    load.transportName ?? null,
    load.vehiclePlate ?? null,
    excelSerial(new Date(load.loadedAt)),
    load.liters,
    tankFilledLabel(load),
    load.notFilledReason ?? null,
    load.fuelBrand ?? null,
    load.odometerKm ?? null,
    load.placeNote ?? null,
    load.ticketUrl ? 'Ver ticket' : null,
    load.odometerUrl ? 'Ver tacómetro' : null,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([REPORT_HEADER, ...body]);
  items.forEach((load, i) => {
    const r = i + 1;
    for (const c of [0, 4]) sheet[XLSX.utils.encode_cell({ r, c })].z = SHEET_DATE_FORMAT;
    const links: Array<[number, FuelLoadPhoto, string | null]> = [
      [TICKET_COL, 'ticket', load.ticketUrl],
      [ODOMETER_COL, 'odometer', load.odometerUrl],
    ];
    for (const [c, photo, url] of links) {
      if (!url) continue;
      sheet[XLSX.utils.encode_cell({ r, c })].l = { Target: `${origin}${fuelLoadPhotoPath(load.id, photo)}` };
    }
  });
  sheet['!cols'] = REPORT_WIDTHS.map((wch) => ({ wch }));
  sheet['!autofilter'] = { ref: sheet['!ref'] ?? 'A1' };
  return sheet;
}

const EXPORT_PAGE_SIZE = 100;

/** Downloads every load matching the filters, not just the page on screen. */
async function exportFuelLoadsExcel(filters: FuelLoadsFilters): Promise<number> {
  const base = { ...fuelLoadsQuery(filters), limit: EXPORT_PAGE_SIZE };
  const items: FuelLoadView[] = [];
  for (let page = 1; ; page++) {
    const res = await logisticaApi.listFuelLoads({ ...base, page });
    items.push(...res.items);
    if (res.items.length === 0 || items.length >= res.total) break;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildFuelLoadsSheet(items, window.location.origin), 'Combustible');
  const suffix = [filters.dateFrom, filters.dateTo].filter(Boolean).join('_a_') || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `combustible-${suffix}.xlsx`);
  return items.length;
}

/**
 * Target of the Excel photo links. The route sits behind login, so it asks the API for
 * a fresh signed link and replaces itself with the photo.
 */
export function FuelLoadPhotoPage() {
  const { id, photo } = useParams<{ id: string; photo: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || (photo !== 'ticket' && photo !== 'odometer')) {
      setError('Link de foto inválido');
      return;
    }
    let cancelled = false;
    logisticaApi
      .fuelLoadPhotoUrl(id, photo)
      .then(({ url }) => { if (!cancelled) window.location.replace(url); })
      .catch((err) => { if (!cancelled) setError((err as Error).message || 'No se pudo abrir la foto'); });
    return () => { cancelled = true; };
  }, [id, photo]);

  return (
    <div className="flex h-64 items-center justify-center p-6 text-sm">
      {error
        ? <span className="text-destructive">{error}</span>
        : <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />}
    </div>
  );
}

/** Deleting a fuel load is reserved to the superadmin. */
export function canDeleteFuelLoads(user: { globalRole: GlobalRole } | null | undefined): boolean {
  return user?.globalRole === GlobalRole.SUPERADMIN;
}

export function FuelLoadsTable({
  items,
  onPreview,
  onEdit,
  onDelete,
}: {
  items: FuelLoadView[];
  onPreview: (url: string) => void;
  /** Shows a correct (km, truck) button per row when given. */
  onEdit?: (load: FuelLoadView) => void;
  /** Shows a delete button per row when given. */
  onDelete?: (load: FuelLoadView) => void;
}) {
  const hasActions = Boolean(onEdit || onDelete);
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
            <th className={th}>¿Se llenó?</th>
            <th className={th}>Bandera</th>
            <th className={th}>Lugar</th>
            <th className={th}>Ticket</th>
            <th className={th}>Odómetro</th>
            {hasActions && <th className={th} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={hasActions ? 12 : 11} className="px-4 py-8 text-center text-muted-foreground">
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
                      <span>{tankFilledLabel(load) ?? '—'}</span>
                      {load.notFilledReason && (
                        <span className="text-xs text-muted-foreground">{load.notFilledReason}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{load.fuelBrand ?? '—'}</td>
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
                  {hasActions && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(load)}
                          aria-label="Corregir carga"
                          title="Corregir km o camión"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && <button
                        type="button"
                        onClick={() => onDelete(load)}
                        aria-label="Eliminar carga"
                        title="Eliminar carga"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>}
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

function EditFuelLoadDialog({
  load,
  onClose,
  onSaved,
}: {
  load: FuelLoadView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [km, setKm] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState<VehicleView[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!load) return;
    setKm(load.odometerKm != null ? String(load.odometerKm) : '');
    setVehicleId(load.vehicleId ?? '');
    let cancelled = false;
    logisticaApi
      .listVehicles(load.transportId)
      .then((list) => {
        if (cancelled) return;
        // The current truck stays listed even if it no longer qualifies, so saving the km alone keeps it.
        const plates = fuelPlates(list);
        const current = list.find((v) => v.id === load.vehicleId && !plates.includes(v));
        setVehicles(current ? [...plates, current] : plates);
      })
      .catch(() => { if (!cancelled) setVehicles([]); });
    return () => { cancelled = true; };
  }, [load]);

  if (!load) return null;

  const save = async () => {
    const payload: { odometerKm?: number; vehicleId?: string | null } = {};
    if (km.trim() !== '') {
      const parsed = parseKm(km);
      if (parsed == null) {
        toast.error('Los km tienen que ser un número entero');
        return;
      }
      if (parsed !== load.odometerKm) payload.odometerKm = parsed;
    } else if (load.odometerKm != null) {
      toast.error('Los km no se pueden dejar vacíos');
      return;
    }
    if ((vehicleId || null) !== load.vehicleId) payload.vehicleId = vehicleId || null;
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await logisticaApi.updateFuelLoad(load.id, payload);
      toast.success('Carga de combustible corregida');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo corregir la carga');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Corregir carga" description={`${load.driverName ?? 'Chofer'} · ${load.transportName ?? ''}`}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="fuel-km">Km</Label>
          <Input id="fuel-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fuel-vehicle">Camión</Label>
          <select id="fuel-vehicle" className={`${fieldClass} w-full`} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Sin camión</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.label ? `${v.plate} · ${v.label}` : v.plate}</option>
            ))}
          </select>
          {vehicles.length === 0 && (
            <p className="text-xs text-muted-foreground">El transporte no tiene camiones cargados. Se agregan desde Transportes.</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} onClick={() => void save()}>Guardar</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Trucks drivers can pick in the app: active, not bateas, by plate. */
export function fuelPlates(vehicles: VehicleView[]): VehicleView[] {
  return vehicles
    .filter((v) => v.active && v.kind !== 'batea')
    .sort((a, b) => a.plate.localeCompare(b.plate));
}

/** Logística EDITOR: list, add, fix and remove the plates drivers pick from. */
function PlatesDialog({
  open,
  onClose,
  transports,
  initialTransportId,
}: {
  open: boolean;
  onClose: () => void;
  transports: Array<{ id: string; name: string }>;
  initialTransportId?: string;
}) {
  const [transportId, setTransportId] = useState('');
  const [plates, setPlates] = useState<VehicleView[]>([]);
  const [newPlate, setNewPlate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPlate, setEditingPlate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTransportId(initialTransportId ?? transports[0]?.id ?? '');
  }, [open, initialTransportId, transports]);

  const reload = async (id: string) => {
    if (!id) {
      setPlates([]);
      return;
    }
    try {
      setPlates(fuelPlates(await logisticaApi.listVehicles(id)));
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron cargar las patentes');
    }
  };

  useEffect(() => {
    if (open) void reload(transportId);
  }, [open, transportId]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await reload(transportId);
      return true;
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo guardar');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!newPlate.trim()) return;
    const ok = await run(
      () => logisticaApi.createVehicle({ transportId, plate: newPlate, kind: 'camion' }),
      'Patente agregada',
    );
    if (ok) setNewPlate('');
  };

  const rename = async (vehicle: VehicleView) => {
    if (!editingPlate.trim() || editingPlate.trim().toUpperCase() === vehicle.plate) {
      setEditingId(null);
      return;
    }
    const ok = await run(() => logisticaApi.updateVehicle(vehicle.id, { plate: editingPlate }), 'Patente corregida');
    if (ok) setEditingId(null);
  };

  const remove = async (vehicle: VehicleView) => {
    if (!window.confirm(`¿Quitar la patente ${vehicle.plate}? Los choferes ya no la van a ver en la app.`)) return;
    await run(() => logisticaApi.updateVehicle(vehicle.id, { active: false }), 'Patente quitada');
  };

  return (
    <Dialog open={open} onClose={onClose} title="Patentes" description="Los camiones que el chofer elige en la app al cargar combustible.">
      <div className="space-y-4">
        {transports.length > 1 && (
          <select className={`${fieldClass} w-full`} value={transportId} onChange={(e) => setTransportId(e.target.value)}>
            {transports.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <ul className="divide-y divide-border rounded-md border border-border">
          {plates.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No hay patentes cargadas</li>}
          {plates.map((vehicle) => (
            <li key={vehicle.id} className="flex items-center justify-between gap-2 px-3 py-2">
              {editingId === vehicle.id ? (
                <Input
                  autoFocus
                  value={editingPlate}
                  onChange={(e) => setEditingPlate(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void rename(vehicle); if (e.key === 'Escape') setEditingId(null); }}
                />
              ) : (
                <span className="font-mono">{vehicle.plate}</span>
              )}
              <div className="flex shrink-0 gap-1">
                {editingId === vehicle.id ? (
                  <Button size="sm" loading={busy} onClick={() => void rename(vehicle)}>Guardar</Button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`Corregir ${vehicle.plate}`}
                      onClick={() => { setEditingId(vehicle.id); setEditingPlate(vehicle.plate); }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar ${vehicle.plate}`}
                      onClick={() => void remove(vehicle)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            placeholder="Nueva patente"
            value={newPlate}
            onChange={(e) => setNewPlate(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
          />
          <Button loading={busy} disabled={!transportId || !newPlate.trim()} onClick={() => void add()}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
      </div>
    </Dialog>
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
  const { canEdit } = useCanPerform(ModuleKey.LOGISTICA);
  const [editing, setEditing] = useState<FuelLoadView | null>(null);
  const [exporting, setExporting] = useState(false);
  const [platesOpen, setPlatesOpen] = useState(false);

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

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await exportFuelLoadsExcel(filters);
      toast.success(`${count} cargas exportadas`);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo exportar el Excel');
    } finally {
      setExporting(false);
    }
  };

  const page = filters.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) : 1;
  const hasFilters = Boolean(filters.transportId || filters.dateFrom || filters.dateTo);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Combustible</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{data?.total ?? 0} en total</span>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setPlatesOpen(true)}>
              <Truck className="h-3.5 w-3.5 mr-1" /> Patentes
            </Button>
          )}
          <Button variant="outline" size="sm" loading={exporting} disabled={!data?.total} onClick={() => void handleExport()}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar Excel
          </Button>
        </div>
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
          onEdit={canEdit ? setEditing : undefined}
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

      <PlatesDialog
        open={platesOpen}
        onClose={() => setPlatesOpen(false)}
        transports={transports}
        initialTransportId={filters.transportId}
      />

      <EditFuelLoadDialog
        load={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); setFilters((f) => ({ ...f })); }}
      />

      {/* Read-only preview: without documentId the modal offers no rotation save. */}
      {previewUrl && (
        <FilePreviewModal url={previewUrl} isPdf={false} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}
