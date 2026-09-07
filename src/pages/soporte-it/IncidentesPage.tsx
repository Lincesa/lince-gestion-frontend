import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  deleteIncidente,
  fetchIncidentes,
  updateIncidenteEstado,
} from '@/store/soporte-it/incidentesSlice';
import { toast } from 'sonner';
import type { EstadoIncidente, UrgenciaIncidente } from '@/types/soporte-it.types';
import { formatEquipoLabel } from '@/utils/soporteItEquipo';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

const URGENCIA_COLORS: Record<UrgenciaIncidente, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  media: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
  baja: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
};

const ESTADO_LABELS: Record<EstadoIncidente, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  resolved: 'Resuelto',
};

const ESTADO_COLORS: Record<EstadoIncidente, string> = {
  pending: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
};

export function IncidentesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: incidentes, loading, error } = useAppSelector((s) => s.incidentes);

  useEffect(() => {
    void dispatch(fetchIncidentes());
  }, [dispatch]);

  const pending = incidentes.filter((i) => i.estado !== 'resolved');
  const resolved = incidentes.filter((i) => i.estado === 'resolved');

  async function handleEstado(id: string, estado: EstadoIncidente) {
    try {
      await dispatch(updateIncidenteEstado({ id, payload: { estado } })).unwrap();
      toast.success('Estado actualizado');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    const ok = confirm('¿Eliminar incidente? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      await dispatch(deleteIncidente(id)).unwrap();
      toast.success('Incidente eliminado');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function IncidenteTable({
    items,
    showResolved,
  }: {
    items: typeof incidentes;
    showResolved?: boolean;
  }) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Equipo</th>
              <th className="px-4 py-3 text-left">Reportado por</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Urgencia</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Relevamiento</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((inc) => (
              <tr
                key={inc.id}
                className="hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/soporte-it/incidentes/${inc.id}`)}
              >
                <td className="px-4 py-3 text-muted-foreground">{inc.numeroReporte}</td>
                <td className="px-4 py-3 font-medium">
                  {inc.equipo ? formatEquipoLabel(inc.equipo) : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inc.reportadoPor?.name ?? '—'}
                </td>
                <td className="px-4 py-3 max-w-xs truncate">{inc.descripcion}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCIA_COLORS[inc.urgencia]}`}>
                    {inc.urgencia}
                  </span>
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Select
                    value={inc.estado}
                    onChange={(e) =>
                      void handleEstado(inc.id, e.target.value as EstadoIncidente)
                    }
                    className="text-xs h-7 py-0"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="in_progress">En curso</option>
                    <option value="resolved">Resuelto</option>
                  </Select>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(inc.fechaReporte).toLocaleDateString('es-AR')}
                </td>
                <td className="px-4 py-3">
                  {inc.relevamiento ? (
                    <span className="text-xs text-green-600 font-medium">Sí</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void handleDelete(inc.id)}
                    title="Eliminar incidente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {showResolved ? 'Sin incidentes resueltos' : 'Sin incidentes abiertos'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <AlertCircle className="h-5 w-5" /> Panel de Incidentes
      </h1>

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Abiertos / En curso ({pending.length})
        </h2>
        <IncidenteTable items={pending} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Resueltos ({resolved.length})
        </h2>
        <IncidenteTable items={resolved} showResolved />
      </div>
    </div>
  );
}
