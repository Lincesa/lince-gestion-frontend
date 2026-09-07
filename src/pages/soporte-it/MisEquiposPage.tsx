import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchMisEquipos } from '@/store/soporte-it/equiposSlice';
import type { EstadoEquipo } from '@/types/soporte-it.types';

const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  disponible: 'Disponible',
  asignado: 'Asignado',
  en_reparacion: 'En reparación',
  baja: 'Baja',
};

const ESTADO_COLORS: Record<EstadoEquipo, string> = {
  disponible: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  asignado: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  en_reparacion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  baja: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function MisEquiposPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: equipos, loading, error } = useAppSelector((s) => s.equipos);

  useEffect(() => {
    void dispatch(fetchMisEquipos());
  }, [dispatch]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <Monitor className="h-5 w-5" /> Mis Equipos
      </h1>

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {equipos.length === 0 && !loading && (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
          No tenés equipos asignados
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {equipos.map((e) => (
          <div
            key={e.id}
            className="rounded-lg border border-border p-5 space-y-3 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => navigate(`/soporte-it/mis-equipos/${e.id}`)}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{e.hostname ?? 'Equipo'}</p>
                <p className="text-sm text-muted-foreground">
                  {[e.fabricante, e.modelo].filter(Boolean).join(' ') || '—'}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[e.estado]}`}>
                {ESTADO_LABELS[e.estado]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Sector: {e.sector ?? '—'}</p>
              <p>SO: {e.sistemaOperativo ? e.sistemaOperativo.split('(')[0].trim() : '—'}</p>
              <p>RAM: {e.ramGb ? `${e.ramGb} GB` : '—'}</p>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(ev) => {
                  ev.stopPropagation();
                  navigate(`/soporte-it/reportar?equipoId=${e.id}`);
                }}
              >
                <AlertCircle className="h-4 w-4 mr-1" />
                Reportar incidente
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
