import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';
import { fetchSatisfactions, deleteSatisfaction } from '@/store/crm/satisfactionSlice';
import type { Satisfaction } from '@/types/crm.types';

const CHART_COLORS = [
  'hsl(221.2 83.2% 53.3%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(0 84% 60%)',
];

const RECOMENDACION_LABELS: Record<string, string> = {
  SI: 'Sí', NO: 'No', MAYBE: 'Tal vez',
};

const VALORACION_LABELS: Record<string, string> = {
  CALIDAD: 'Calidad',
  TIEMPO_ENTREGA: 'Tiempo entrega',
  ATENCION: 'Atención',
  RESOLUCION_INCONVENIENTES: 'Resolución',
  SIN_VALORACION: 'Sin valoración',
};

function avg(items: Satisfaction[], key: keyof Satisfaction): string {
  const vals = items.map((s) => s[key] as number | undefined).filter((v): v is number => v != null);
  if (vals.length === 0) return '—';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function KpiCard({ label, value, max }: { label: string; value: string; max?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {max && <p className="mt-0.5 text-xs text-muted-foreground">/ {max}</p>}
    </div>
  );
}

export function SatisfactionPage() {
  const dispatch = useAppDispatch();
  const { list: items, loading, error } = useAppSelector((s) => s.satisfaction);
  const { canAdmin } = useCanPerform(ModuleKey.CRM);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Satisfaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void dispatch(fetchSatisfactions());
  }, [dispatch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((s) =>
      [s.name, s.phone, s.product].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [items, search]);

  const avgCalidad = avg(items, 'calidad');
  const avgAtencion = avg(items, 'atencion');
  const pctRecomiendan = items.length
    ? `${Math.round((items.filter((s) => s.recomendacion === 'SI').length / items.length) * 100)}%`
    : '—';

  const calidadByRec = ['SI', 'NO', 'MAYBE'].map((rec) => {
    const group = items.filter((s) => s.recomendacion === rec);
    const vals = group.map((s) => s.calidad).filter((v): v is number => v != null);
    return {
      name: RECOMENDACION_LABELS[rec] ?? rec,
      calidad: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0,
    };
  });

  const valoracionData = Object.entries(VALORACION_LABELS).map(([key, label]) => ({
    name: label,
    value: items.filter((s) => s.valoracion === key).length,
  })).filter((d) => d.value > 0);

  function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dispatch(deleteSatisfaction(deleteTarget.id)).unwrap();
      toast.success('Respuesta eliminada');
      setDeleteTarget(null);
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px',
      fontSize: '12px',
    },
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Satisfacción</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 h-20 animate-pulse bg-muted" />
          ))
        ) : (
          <>
            <KpiCard label="Calidad promedio" value={avgCalidad} max="10" />
            <KpiCard label="Atención promedio" value={avgAtencion} max="10" />
            <KpiCard label="Recomendarían" value={pctRecomiendan} />
          </>
        )}
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-foreground mb-4">Calidad promedio por recomendación</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={calidadByRec}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="calidad" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="Calidad" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-foreground mb-4">Lo más valorado</h3>
            {valoracionData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={valoracionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {valoracionData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, producto..."
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse bg-muted rounded" />)}
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-sm text-destructive mb-2">Error al cargar datos.</p>
            <button onClick={() => void dispatch(fetchSatisfactions())} className="text-sm text-primary hover:underline">Reintentar</button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Teléfono</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Producto</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Calidad</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Atención</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Recomienda</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Valoración</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">No se encontraron respuestas.</td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2.5 text-foreground">{s.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.phone ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[120px]">
                          <span className="truncate block" title={s.product}>{s.product ?? '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.calidad ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.atencion ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          {s.recomendacion ? (
                            <span className={[
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              s.recomendacion === 'SI' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              s.recomendacion === 'NO' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                            ].join(' ')}>
                              {RECOMENDACION_LABELS[s.recomendacion] ?? s.recomendacion}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {s.valoracion ? (VALORACION_LABELS[s.valoracion] ?? s.valoracion) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(s.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          {canAdmin && (
                            <button onClick={() => setDeleteTarget(s)} className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg w-full max-w-sm mx-4 p-6 shadow-lg">
            <h3 className="text-base font-semibold text-foreground mb-2">Eliminar respuesta</h3>
            <p className="text-sm text-muted-foreground mb-6">
              ¿Confirmar la eliminación de la respuesta de{' '}
              <span className="font-medium text-foreground">{deleteTarget.name ?? deleteTarget.phone ?? 'este usuario'}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                Cancelar
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
