import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchRemitos } from '@/store/logistica/remitosSlice';
import { type ListRemitosParams } from '@/api/logistica';
import { RemitoDetailModal } from '@/components/logistica/RemitoDetailModal';
import { UPLOADER_CHIPS } from '@/constants/uploaderChips';

export function RemitosListPage() {
  const dispatch   = useAppDispatch();
  const { list, loading, error, pagination } = useAppSelector((s) => s.remitosLogistica);

  const [filters, setFilters] = useState<ListRemitosParams>({ page: 1, limit: 20 });
  const [nroInput, setNroInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Remitos</h2>
        <span className="text-sm text-muted-foreground">{pagination.total} en total</span>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
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
          <input
            type="date"
            title="Desde"
            value={filters.dateFrom ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            title="Hasta"
            value={filters.dateTo ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Chips de procedencia */}
        <div className="flex flex-wrap gap-2">
          {UPLOADER_CHIPS.map((chip) => {
            const active = filters.uploadedByEmail === chip.email;
            return (
              <button
                key={chip.email}
                onClick={() => setFilters((f) => ({
                  ...f,
                  uploadedByEmail: active ? undefined : chip.email,
                  page: 1,
                }))}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {!loading && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha de subida</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° remito</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subido por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No hay remitos
                  </td>
                </tr>
              ) : (
                list.map((remito) => (
                  <tr
                    key={remito.id}
                    onClick={() => setSelectedId(remito.id)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(remito.createdAt).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {remito.nroRemito ?? (
                        <span className="text-muted-foreground italic">No se obtuvo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{remito.uploadedByName}</span>
                        <span className="text-xs text-muted-foreground">{remito.uploadedByEmail}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

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

      {selectedId && (
        <RemitoDetailModal
          remitoId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
