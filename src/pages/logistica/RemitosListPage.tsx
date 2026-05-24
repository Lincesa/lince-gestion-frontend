import { useEffect, useRef, useState } from 'react';
import { Download, Eye, MapPin, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchRemitos } from '@/store/logistica/remitosSlice';
import { logisticaApi, type ListRemitosParams } from '@/api/logistica';

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE:          'Pendiente',
  PROCESANDO:         'Procesando',
  VALIDO:             'Válido',
  CON_ERRORES:        'Con errores',
  REVISION_PENDIENTE: 'Revisión pendiente',
  REVISADO:           'Revisado',
  APROBADO:           'Aprobado',
  RECHAZADO:          'Rechazado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE:          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PROCESANDO:         'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  VALIDO:             'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CON_ERRORES:        'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  REVISION_PENDIENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  REVISADO:           'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  APROBADO:           'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  RECHAZADO:          'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
};

export function RemitosListPage() {
  const dispatch   = useAppDispatch();
  const { list, loading, error, pagination } = useAppSelector((s) => s.remitosLogistica);

  const [filters, setFilters] = useState<ListRemitosParams>({ page: 1, limit: 20 });
  const [nroInput, setNroInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void dispatch(fetchRemitos(filters));
  }, [dispatch, filters]);

  const handleNroChange = (value: string) => {
    setNroInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, nroRemito: value || undefined, page: 1 }));
    }, 400);
  };

  const setFilter = (patch: Partial<ListRemitosParams>) =>
    setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Remitos</h2>
        <span className="text-sm text-muted-foreground">{pagination.total} en total</span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Nro. remito…"
            value={nroInput}
            onChange={(e) => handleNroChange(e.target.value)}
            className="pl-8 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-40"
          />
        </div>
        <select
          value={filters.status ?? ''}
          onChange={(e) => setFilter({ status: e.target.value || undefined })}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los estados</option>
          {Object.keys(STATUS_LABELS).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input
          type="date"
          title="Desde"
          value={filters.dateFrom ?? ''}
          onChange={(e) => setFilter({ dateFrom: e.target.value || undefined })}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="date"
          title="Hasta"
          value={filters.dateTo ?? ''}
          onChange={(e) => setFilter({ dateTo: e.target.value || undefined })}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {!loading && <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° Remito</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subido por</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Geo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No hay remitos
                </td>
              </tr>
            ) : (
              list.map((remito) => (
                <tr key={remito.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono">
                    {remito.nroRemito ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {remito.fecha ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {remito.cliente ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span>{remito.uploadedByName}</span>
                      <span className="text-xs text-muted-foreground">{remito.uploadedByEmail}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[remito.status] ?? ''}`}>
                      {STATUS_LABELS[remito.status] ?? remito.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {remito.latitude !== null && remito.longitude !== null ? (
                      <MapPin className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const { url } = await logisticaApi.getViewUrl(remito.id);
                          if (url) window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Ver imagen"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <a
                        href={logisticaApi.getFileUrl(remito.id)}
                        download
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>}

      {!loading && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, (filters.page ?? 1) - 1))}
            disabled={(filters.page ?? 1) <= 1}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            {filters.page ?? 1} / {pagination.pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.pages, (filters.page ?? 1) + 1))}
            disabled={(filters.page ?? 1) >= pagination.pages}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
