import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchMisIncidentes } from '@/store/soporte-it/incidentesSlice';
import type { EstadoIncidente, UrgenciaIncidente } from '@/types/soporte-it.types';
import { formatEquipoLabel } from '@/utils/soporteItEquipo';
import { Button } from '@/components/ui/Button';

const URGENCIA_COLORS: Record<UrgenciaIncidente, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baja: 'bg-blue-100 text-blue-700',
};

const ESTADO_LABELS: Record<EstadoIncidente, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  resolved: 'Resuelto',
};

export function MisIncidentesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: incidentes, loading, error } = useAppSelector((s) => s.incidentes);

  useEffect(() => {
    void dispatch(fetchMisIncidentes());
  }, [dispatch]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> Mis Incidentes
        </h1>
        <Button size="sm" onClick={() => navigate('/soporte-it/reportar')}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo incidente
        </Button>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {incidentes.length === 0 && !loading && (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
          No tenés incidentes registrados
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        {incidentes.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Equipo</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Urgencia</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incidentes.map((inc) => (
                <tr
                  key={inc.id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/soporte-it/mis-incidentes/${inc.id}`)}
                >
                  <td className="px-4 py-3 text-muted-foreground">{inc.numeroReporte}</td>
                  <td className="px-4 py-3 font-medium">
                    {inc.equipo ? formatEquipoLabel(inc.equipo) : '—'}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{inc.descripcion}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCIA_COLORS[inc.urgencia]}`}>
                      {inc.urgencia}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {ESTADO_LABELS[inc.estado]}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(inc.fechaReporte).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
