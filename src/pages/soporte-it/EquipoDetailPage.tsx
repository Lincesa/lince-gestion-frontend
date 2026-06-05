import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearSelected, fetchEquipo } from '@/store/soporte-it/equiposSlice';
import { fetchIncidentesByEquipo } from '@/store/soporte-it/incidentesSlice';
import { GlobalRole } from '@/types';
import type { EstadoEquipo, UrgenciaIncidente, EstadoIncidente } from '@/types/soporte-it.types';
import { Button } from '@/components/ui/Button';

const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  activo: 'Activo',
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
  const isSuperAdmin = user?.globalRole === GlobalRole.SUPERADMIN;

  useEffect(() => {
    if (!id) return;
    dispatch(clearSelected());
    void dispatch(fetchEquipo(id));
    void dispatch(fetchIncidentesByEquipo(id));
    return () => {
      dispatch(clearSelected());
    };
  }, [dispatch, id]);

  if (!equipo || equipo.id !== id) {
    return (
      <div className="p-6 text-muted-foreground text-sm">Cargando equipo...</div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">
          {equipo.hostname ?? 'Equipo sin nombre'}
        </h1>
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
          {ESTADO_LABELS[equipo.estado]}
        </span>
      </div>

      {/* Datos técnicos */}
      <div className="rounded-lg border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
          Datos del equipo
        </h2>
        <Row label="N° Activo" value={equipo.numeroActivo} />
        <Row label="A cargo de" value={equipo.aCargoDe} />
        <Row label="Sector" value={equipo.sector} />
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
        {equipo.notas && <Row label="Notas" value={equipo.notas} />}
      </div>

      {/* Usuario asignado */}
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
          <p className="text-sm text-muted-foreground">Sin usuario asignado</p>
        )}
      </div>

      {/* Historial de incidentes */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
            Historial de incidentes
          </h2>
          {!isSuperAdmin && (
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
                {isSuperAdmin && <th className="px-4 py-2 text-left">Acciones</th>}
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
                  {isSuperAdmin && (
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
    </div>
  );
}
