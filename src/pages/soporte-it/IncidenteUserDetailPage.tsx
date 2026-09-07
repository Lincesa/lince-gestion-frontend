import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchIncidente } from '@/store/soporte-it/incidentesSlice';
import { fetchRelevamientoByIncidente } from '@/store/soporte-it/relevamientosSlice';
import type { EstadoIncidente, UrgenciaIncidente } from '@/types/soporte-it.types';
import { formatEquipoLabel } from '@/utils/soporteItEquipo';

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

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

export function IncidenteUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const incidente = useAppSelector((s) => s.incidentes.selected);
  const relevamiento = useAppSelector((s) => s.relevamientos.current);

  useEffect(() => {
    if (!id) return;
    void dispatch(fetchIncidente(id));
    void dispatch(fetchRelevamientoByIncidente(id));
  }, [dispatch, id]);

  if (!incidente) {
    return <div className="p-6 text-muted-foreground text-sm">Cargando...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">
          Incidente #{incidente.numeroReporte}
        </h1>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCIA_COLORS[incidente.urgencia]}`}
        >
          {incidente.urgencia}
        </span>
        <span className="text-xs text-muted-foreground px-2 py-0.5 border rounded">
          {ESTADO_LABELS[incidente.estado]}
        </span>
      </div>

      <div className="rounded-lg border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
          Tu reporte
        </h2>
        <Row
          label="Equipo"
          value={incidente.equipo ? formatEquipoLabel(incidente.equipo) : undefined}
        />
        <Row label="Descripción" value={incidente.descripcion} />
        <Row label="Fecha" value={new Date(incidente.fechaReporte).toLocaleString('es-AR')} />
        <Row label="Aplicaciones afectadas" value={incidente.aplicacionesAfectadas} />
        <Row label="Acciones previas" value={incidente.accionesPrevias} />
      </div>

      {relevamiento ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Informe técnico
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fecha: {relevamiento.fecha}
              {relevamiento.modalidad ? ` · ${relevamiento.modalidad}` : ''}
              {relevamiento.creadoPor ? ` · Técnico: ${relevamiento.creadoPor.name}` : ''}
            </p>
          </div>
          <div className="p-5 space-y-5">
            {relevamiento.items.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Diagnóstico</h3>
                {relevamiento.items.map((item) => (
                  <div key={item.id} className="space-y-2 border-l-2 border-border pl-4">
                    <p className="text-sm font-medium">{item.titulo}</p>
                    {item.procedimiento && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Procedimiento: </span>
                        {item.procedimiento}
                      </div>
                    )}
                    {item.observacion && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Observación: </span>
                        {item.observacion}
                      </div>
                    )}
                    {item.conclusion && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Conclusión: </span>
                        {item.conclusion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {relevamiento.conclusionGeneral && (
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-medium">Conclusión general</h3>
                <p className="text-sm">{relevamiento.conclusionGeneral}</p>
              </div>
            )}

            {relevamiento.pasosASeguir && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Pasos a seguir</h3>
                <p className="text-sm">{relevamiento.pasosASeguir}</p>
              </div>
            )}

            {relevamiento.recomendaciones && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Recomendaciones</h3>
                <p className="text-sm">{relevamiento.recomendaciones}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-5 text-center text-sm text-muted-foreground">
          El equipo de IT aún no ha realizado el relevamiento técnico de este incidente.
        </div>
      )}
    </div>
  );
}
