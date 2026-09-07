import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  assignEquipo,
  clearSelected,
  fetchEquipo,
  unassignEquipo,
} from '@/store/soporte-it/equiposSlice';
import { fetchIncidentesByEquipo } from '@/store/soporte-it/incidentesSlice';
import { fetchUsers } from '@/store/admin/usersSlice';
import { isSoporteItAdmin } from '@/permissions/soporteIt';
import { soporteItApi } from '@/api/soporte-it';
import type {
  EquipoAsignacion,
  EstadoEquipo,
  UrgenciaIncidente,
  EstadoIncidente,
} from '@/types/soporte-it.types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';

const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  disponible: 'Disponible',
  asignado: 'Asignado',
  en_reparacion: 'En reparación',
  baja: 'Baja',
};

const URGENCIA_COLORS: Record<UrgenciaIncidente, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  media: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
  baja: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
};

const ESTADO_INC_LABELS: Record<EstadoIncidente, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  resolved: 'Resuelto',
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground text-sm w-48 shrink-0">{label}</span>
      <span className="text-sm break-all">{value ?? '—'}</span>
    </div>
  );
}

export function EquipoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const equipo = useAppSelector((s) => s.equipos.selected);
  const incidentes = useAppSelector((s) => s.incidentes.items);
  const users = useAppSelector((s) => s.users.list);
  const canManageSoporteIt = isSoporteItAdmin(user);
  const [asignaciones, setAsignaciones] = useState<EquipoAsignacion[]>([]);
  const [showAsignar, setShowAsignar] = useState(false);
  const [showDevolver, setShowDevolver] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignMotivo, setAssignMotivo] = useState('');
  const [devolverMotivo, setDevolverMotivo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    dispatch(clearSelected());
    void dispatch(fetchEquipo(id));
    void dispatch(fetchIncidentesByEquipo(id));
    return () => {
      dispatch(clearSelected());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!canManageSoporteIt) return;
    void dispatch(fetchUsers({ limit: 200 }));
  }, [dispatch, canManageSoporteIt]);

  useEffect(() => {
    if (!id || !canManageSoporteIt) return;
    void soporteItApi
      .getEquipoAsignaciones(id)
      .then(setAsignaciones)
      .catch((err: Error) => toast.error(err.message));
  }, [id, canManageSoporteIt, equipo?.usuarioPlatId]);

  async function reloadAsignaciones() {
    if (!id || !canManageSoporteIt) return;
    const rows = await soporteItApi.getEquipoAsignaciones(id);
    setAsignaciones(rows);
  }

  async function handleAsignar() {
    if (!id || !assignUserId) {
      toast.error('Seleccioná un usuario');
      return;
    }
    setActionLoading(true);
    try {
      await dispatch(
        assignEquipo({
          id,
          usuarioPlatId: assignUserId,
          motivo: assignMotivo.trim() || undefined,
        }),
      ).unwrap();
      toast.success('Equipo asignado');
      setShowAsignar(false);
      setAssignUserId('');
      setAssignMotivo('');
      await reloadAsignaciones();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDevolver() {
    if (!id) return;
    setActionLoading(true);
    try {
      await dispatch(
        unassignEquipo({
          id,
          motivo: devolverMotivo.trim() || undefined,
        }),
      ).unwrap();
      toast.success('Equipo devuelto a stock');
      setShowDevolver(false);
      setDevolverMotivo('');
      await reloadAsignaciones();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  if (!equipo || equipo.id !== id) {
    return (
      <div className="p-6 text-muted-foreground text-sm">Cargando equipo...</div>
    );
  }

  const titulo =
    equipo.tipo === 'celular'
      ? equipo.imei || equipo.linea || equipo.modelo || 'Celular'
      : equipo.hostname ?? 'Equipo sin nombre';
  const canAsignar = canManageSoporteIt && equipo.estado !== 'baja' && !equipo.usuarioPlatId;
  const canDevolver = canManageSoporteIt && Boolean(equipo.usuarioPlatId);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">{titulo}</h1>
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
          {ESTADO_LABELS[equipo.estado]}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {canAsignar && (
            <Button size="sm" onClick={() => setShowAsignar(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Asignar
            </Button>
          )}
          {canDevolver && (
            <Button size="sm" variant="outline" onClick={() => setShowDevolver(true)}>
              <UserMinus className="h-4 w-4 mr-1" /> Devolver
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
          Datos del equipo
        </h2>
        <Row label="Tipo" value={equipo.tipo === 'celular' ? 'Celular' : 'Notebook'} />
        <Row label="N° Activo" value={equipo.numeroActivo} />
        <Row label="Sector" value={equipo.sector} />
        {equipo.tipo === 'celular' ? (
          <>
            <Row label="IMEI" value={equipo.imei} />
            <Row label="Línea" value={equipo.linea} />
            <Row label="Chip" value={equipo.chip} />
            <Row label="Fabricante" value={equipo.fabricante} />
            <Row label="Modelo" value={equipo.modelo} />
            <Row label="RAM" value={equipo.ramGb ? `${equipo.ramGb} GB` : null} />
          </>
        ) : (
          <>
            <Row label="Hostname" value={equipo.hostname} />
            <Row label="Windows User ID" value={equipo.windowsUserId} />
            <Row label="Fabricante" value={equipo.fabricante} />
            <Row label="Modelo" value={equipo.modelo} />
            <Row label="RAM" value={equipo.ramGb ? `${equipo.ramGb} GB` : null} />
            <Row label="Sistema operativo" value={equipo.sistemaOperativo} />
            <Row label="Procesador" value={equipo.procesador} />
            <Row label="Firmware UEFI" value={equipo.firmwareUefi} />
            <Row label="Gráficos" value={equipo.graficos} />
            <Row label="Almacenamiento" value={equipo.almacenamiento} />
            <Row label="Adaptador de red" value={equipo.adaptadorRed} />
            <Row label="Controlador USB" value={equipo.controladorUsbHost} />
            <Row label="Fecha instalación SO" value={equipo.fechaInstalacionSO} />
          </>
        )}
        {equipo.notas && <Row label="Notas" value={equipo.notas} />}
      </div>

      <div className="rounded-lg border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
          Usuario asignado
        </h2>
        {equipo.usuarioPlat ? (
          <div>
            <p className="text-sm font-medium">{equipo.usuarioPlat.name}</p>
            <p className="text-sm text-muted-foreground">{equipo.usuarioPlat.email}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin usuario asignado (stock)</p>
        )}
      </div>

      {canManageSoporteIt && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Historial de asignaciones
            </h2>
          </div>
          {asignaciones.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Sin asignaciones registradas</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Usuario</th>
                  <th className="px-4 py-2 text-left">Desde</th>
                  <th className="px-4 py-2 text-left">Hasta</th>
                  <th className="px-4 py-2 text-left">Motivo</th>
                  <th className="px-4 py-2 text-left">Asignó</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {asignaciones.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2">
                      {a.usuarioPlat?.name ?? a.usuarioPlatId ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(a.desde).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {a.hasta ? new Date(a.hasta).toLocaleString('es-AR') : 'Actual'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{a.motivo ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {a.asignadoPor?.name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
            Historial de incidentes
          </h2>
          {!canManageSoporteIt && (
            <Link to={`/soporte-it/reportar?equipoId=${equipo.id}`}>
              <Button size="sm" variant="outline">
                <AlertCircle className="h-4 w-4 mr-1" /> Reportar incidente
              </Button>
            </Link>
          )}
        </div>
        {incidentes.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Sin incidentes registrados
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Descripción</th>
                <th className="px-4 py-2 text-left">Urgencia</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                {canManageSoporteIt && <th className="px-4 py-2 text-left">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incidentes.map((inc) => (
                <tr key={inc.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2 text-muted-foreground">{inc.numeroReporte}</td>
                  <td className="px-4 py-2 max-w-xs truncate">{inc.descripcion}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCIA_COLORS[inc.urgencia]}`}>
                      {inc.urgencia}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {ESTADO_INC_LABELS[inc.estado]}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {new Date(inc.fechaReporte).toLocaleDateString('es-AR')}
                  </td>
                  {canManageSoporteIt && (
                    <td className="px-4 py-2">
                      <Link
                        to={`/soporte-it/incidentes/${inc.id}`}
                        className="text-primary text-xs hover:underline"
                      >
                        Ver / Relevar
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={showAsignar}
        onClose={() => setShowAsignar(false)}
        title={`Asignar: ${titulo}`}
      >
        <div className="space-y-4">
          <div>
            <Label>Usuario plataforma</Label>
            <Select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Input
              value={assignMotivo}
              onChange={(e) => setAssignMotivo(e.target.value)}
              placeholder="Ej: entrega a nuevo ingreso"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAsignar(false)}>
              Cancelar
            </Button>
            <Button disabled={actionLoading} onClick={() => void handleAsignar()}>
              Confirmar asignación
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={showDevolver}
        onClose={() => setShowDevolver(false)}
        title={`Devolver a stock: ${titulo}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El equipo queda sin persona y pasa a estado Disponible.
          </p>
          <div>
            <Label>Motivo (opcional)</Label>
            <Input
              value={devolverMotivo}
              onChange={(e) => setDevolverMotivo(e.target.value)}
              placeholder="Ej: devolución / rotura / baja de usuario"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDevolver(false)}>
              Cancelar
            </Button>
            <Button disabled={actionLoading} onClick={() => void handleDevolver()}>
              Confirmar devolución
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
