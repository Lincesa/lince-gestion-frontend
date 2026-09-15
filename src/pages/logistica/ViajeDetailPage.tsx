import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { logisticaApi } from '@/api/logistica';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { useAppSelector } from '@/store';
import { GlobalRole, ModuleKey } from '@/types';
import type {
  MyTransportView,
  TransportView,
  TripStatus,
  TripView,
  UpdateTripPayload,
} from '@/types/logistica.types';
import { formatTripDate, toLocalDateTimeInput, TRIP_STATUS_LABELS } from '@/utils/logistica';

export function ViajeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [trip, setTrip] = useState<TripView | null>(null);
  const [transports, setTransports] = useState<TransportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<TripStatus>('PLANIFICADO');
  const [transportId, setTransportId] = useState('');
  const [driverIds, setDriverIds] = useState<string[]>([]);
  const [myTransport, setMyTransport] = useState<MyTransportView | null>(null);

  const role = user?.modules?.[ModuleKey.LOGISTICA]?.role;
  const isAdmin =
    user?.globalRole === GlobalRole.SUPERADMIN ||
    user?.globalRole === GlobalRole.ADMIN ||
    role === 'ADMIN';
  const isTransportUser = user?.area?.toUpperCase() === 'TRANSPORTE';
  const canManage = isAdmin || myTransport?.memberRole === 'DUENO';

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [row, transportRows] = await Promise.all([
        logisticaApi.getTrip(id),
        isAdmin
          ? logisticaApi.listTransports()
          : isTransportUser
            ? logisticaApi.getMyTransport().then((transport) => {
                setMyTransport(transport);
                return [transport];
              })
            : Promise.resolve([]),
      ]);
      setTrip(row);
      setTransports(transportRows);
      setOrigin(row.origin);
      setDestination(row.destination);
      setScheduledAt(toLocalDateTimeInput(row.scheduledAt));
      setNotes(row.notes ?? '');
      setStatus(row.status);
      setTransportId(row.transportId);
      setDriverIds(row.drivers.map((driver) => driver.userId));
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo cargar el viaje');
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin, isTransportUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTransport = transports.find((transport) => transport.id === transportId);
  const drivers = useMemo(
    () => selectedTransport?.members.filter(
      (member) => member.role === 'CHOFER' && member.active,
    ) ?? [],
    [selectedTransport],
  );

  const handleSave = async () => {
    if (!id || !origin.trim() || !destination.trim() || !scheduledAt || !transportId) {
      toast.error('Completá transporte, origen, destino y fecha');
      return;
    }
    const payload: UpdateTripPayload = {
      origin: origin.trim(),
      destination: destination.trim(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      await logisticaApi.updateTrip(id, payload);
      const previousDriverIds = trip?.drivers.map((driver) => driver.userId).sort() ?? [];
      const nextDriverIds = [...driverIds].sort();
      if (previousDriverIds.join(',') !== nextDriverIds.join(',')) {
        await logisticaApi.setTripAssignments(id, nextDriverIds);
      }
      if (trip?.status !== status) {
        await logisticaApi.updateTripStatus(id, status);
      }
      toast.success('Viaje actualizado');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo actualizar el viaje');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!trip) {
    return <div className="p-6 text-sm text-muted-foreground">Viaje no encontrado.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/logistica/viajes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold truncate">{trip.origin} → {trip.destination}</h1>
          <p className="text-sm text-muted-foreground">{formatTripDate(trip.scheduledAt)}</p>
        </div>
        <Badge variant={trip.status === 'CANCELADO' ? 'destructive' : 'secondary'}>
          {TRIP_STATUS_LABELS[trip.status]}
        </Badge>
      </div>

      {!canManage ? (
        <Card>
          <CardContent className="pt-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Transporte</dt><dd className="mt-1 font-medium">{trip.transportName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Choferes</dt><dd className="mt-1 font-medium">{trip.drivers.length ? trip.drivers.map((driver) => driver.name || driver.email).join(', ') : 'Sin asignar'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Origen</dt><dd className="mt-1 font-medium">{trip.origin}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Destino</dt><dd className="mt-1 font-medium">{trip.destination}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Observaciones</dt><dd className="mt-1">{trip.notes || '—'}</dd></div>
            </dl>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Editar viaje</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="detail-origin">Origen</Label>
                <Input id="detail-origin" value={origin} onChange={(event) => setOrigin(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="detail-destination">Destino</Label>
                <Input id="detail-destination" value={destination} onChange={(event) => setDestination(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="detail-date">Fecha y hora</Label>
                <Input id="detail-date" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="detail-status">Estado</Label>
                <Select id="detail-status" value={status} onChange={(event) => setStatus(event.target.value as TripStatus)}>
                  {Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="detail-transport">Transporte</Label>
                <Select
                  id="detail-transport"
                  value={transportId}
                  disabled
                >
                  {transports.map((transport) => (
                    <option key={transport.id} value={transport.id}>{transport.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Choferes asignados</Label>
                <div className="rounded-md border border-input p-3 space-y-2">
                  {drivers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay choferes activos.</p>
                  ) : drivers.map((driver) => (
                    <label key={driver.userId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={driverIds.includes(driver.userId)}
                        onChange={(event) => setDriverIds((current) => event.target.checked
                          ? [...current, driver.userId]
                          : current.filter((id) => id !== driver.userId))}
                      />
                      <span>{driver.name || driver.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-notes">Observaciones</Label>
              <textarea id="detail-notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button loading={saving} onClick={() => void handleSave()}>Guardar cambios</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
