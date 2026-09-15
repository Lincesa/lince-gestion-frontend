import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { logisticaApi } from '@/api/logistica';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { useAppSelector } from '@/store';
import { GlobalRole, ModuleKey } from '@/types';
import type {
  CreateTripPayload,
  MyTransportView,
  TransportView,
  TripView,
} from '@/types/logistica.types';
import { formatTripDate, TRIP_STATUS_LABELS } from '@/utils/logistica';

const EMPTY_FORM = {
  transportId: '',
  origin: '',
  destination: '',
  scheduledAt: '',
  notes: '',
  driverIds: [] as string[],
};

export function ViajesPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [trips, setTrips] = useState<TripView[]>([]);
  const [transports, setTransports] = useState<TransportView[]>([]);
  const [myTransport, setMyTransport] = useState<MyTransportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const role = user?.modules?.[ModuleKey.LOGISTICA]?.role;
  const isAdmin =
    user?.globalRole === GlobalRole.SUPERADMIN ||
    user?.globalRole === GlobalRole.ADMIN ||
    role === 'ADMIN';
  const isTransportUser = user?.area?.toUpperCase() === 'TRANSPORTE';
  const canManage = isAdmin || myTransport?.memberRole === 'DUENO';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tripRows, transportRows] = await Promise.all([
        logisticaApi.listTrips(),
        isAdmin
          ? logisticaApi.listTransports()
          : isTransportUser
            ? logisticaApi.getMyTransport().then((transport) => {
                setMyTransport(transport);
                return [transport];
              })
            : Promise.resolve([]),
      ]);
      setTrips(tripRows);
      setTransports(transportRows);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTransportUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTransports = useMemo(
    () => transports.filter((transport) => transport.active),
    [transports],
  );

  const openCreate = () => {
    const transport = activeTransports[0];
    setForm({ ...EMPTY_FORM, transportId: transport?.id ?? '' });
    setFormOpen(true);
  };

  const handleCreate = async () => {
    if (!form.transportId || !form.origin.trim() || !form.destination.trim() || !form.scheduledAt) {
      toast.error('Completá transporte, origen, destino y fecha');
      return;
    }
    const payload: CreateTripPayload = {
      transportId: form.transportId,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      notes: form.notes.trim() || undefined,
      driverIds: form.driverIds,
    };
    setSaving(true);
    try {
      await logisticaApi.createTrip(payload);
      toast.success('Viaje creado');
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo crear el viaje');
    } finally {
      setSaving(false);
    }
  };

  const selectedTransport = activeTransports.find(
    (transport) => transport.id === form.transportId,
  );
  const drivers = selectedTransport?.members.filter(
    (member) =>
      (member.role === 'CHOFER' || member.role === 'DUENO') && member.active,
  ) ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Viajes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planificación, asignación y seguimiento de viajes.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo viaje
          </Button>
        )}
      </div>

      {loading ? (
        <div className="min-h-[240px] flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : trips.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay viajes disponibles.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              to={`/logistica/viajes/${trip.id}`}
              className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{trip.origin}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{trip.destination}</span>
                  </div>
                </div>
                <Badge variant={trip.status === 'CANCELADO' ? 'destructive' : 'secondary'}>
                  {TRIP_STATUS_LABELS[trip.status]}
                </Badge>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <p>{formatTripDate(trip.scheduledAt)}</p>
                <p className="text-muted-foreground truncate">{trip.transportName}</p>
                <p className="text-muted-foreground truncate">
                  {trip.drivers.length
                    ? `Choferes: ${trip.drivers.map((driver) => driver.name || driver.email).join(', ')}`
                    : 'Sin choferes asignados'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo viaje"
        description="Definí el recorrido y, si querés, asigná un chofer."
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="trip-transport">Transporte</Label>
            <Select
              id="trip-transport"
              value={form.transportId}
              onChange={(event) => setForm((current) => ({
                ...current,
                transportId: event.target.value,
                driverIds: [],
              }))}
            >
              <option value="">Seleccionar</option>
              {activeTransports.map((transport) => (
                <option key={transport.id} value={transport.id}>{transport.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="trip-origin">Origen</Label>
              <Input
                id="trip-origin"
                value={form.origin}
                onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-destination">Destino</Label>
              <Input
                id="trip-destination"
                value={form.destination}
                onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trip-date">Fecha y hora</Label>
            <Input
              id="trip-date"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Choferes</Label>
            <div className="rounded-md border border-input p-3 space-y-2">
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedTransport
                    ? 'Este transporte no tiene integrantes activos. Agregá choferes en Transportes o Usuarios de campo.'
                    : 'Seleccioná un transporte para ver integrantes.'}
                </p>
              ) : drivers.map((driver) => (
                <label key={driver.userId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.driverIds.includes(driver.userId)}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      driverIds: event.target.checked
                        ? [...current.driverIds, driver.userId]
                        : current.driverIds.filter((id) => id !== driver.userId),
                    }))}
                  />
                  <span>
                    {driver.name || driver.email}
                    {driver.role === 'DUENO' ? ' (dueño)' : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trip-notes">Observaciones</Label>
            <textarea
              id="trip-notes"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={() => void handleCreate()}>Crear viaje</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
