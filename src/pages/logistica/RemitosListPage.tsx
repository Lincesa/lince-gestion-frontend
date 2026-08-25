import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchRemitos, removeRemitoFromList } from '@/store/logistica/remitosSlice';
import { logisticaApi, type ListRemitosParams } from '@/api/logistica';
import { RemitoDetailPanel } from '@/components/logistica/RemitoDetailPanel';
import { RemitosFiltersBar } from '@/components/logistica/RemitosFiltersBar';
import type { RemitoLogistica } from '@/types/logistica.types';
import type { RemitoFilterOptions } from '@/types/remitos-filters.types';
import { EMPTY_REMITO_FILTERS, hasRemitoExportFilters } from '@/types/remitos-filters.types';

export function RemitosListPage() {
  const dispatch   = useAppDispatch();
  const { list, loading, error, pagination } = useAppSelector((s) => s.remitosLogistica);

  const [filters, setFilters]       = useState<ListRemitosParams>(EMPTY_REMITO_FILTERS);
  const [nroInput, setNroInput]     = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<RemitoFilterOptions>({ ptoVentas: [], choferes: [] });
  const [exporting, setExporting] = useState(false);

  const currentIndex = selectedId ? list.findIndex((r) => r.id === selectedId) : -1;

  useEffect(() => {
    logisticaApi.getRemitoFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  useEffect(() => {
    void dispatch(fetchRemitos(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    if (!selectedId || list.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = list[currentIndex + 1];
        if (next) openDetail(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = list[currentIndex - 1];
        if (prev) openDetail(prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedId, list, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = (remito: RemitoLogistica) => {
    setSelectedId(remito.id);
    requestAnimationFrame(() => {
      document.querySelector(`[data-remito-id="${remito.id}"]`)?.scrollIntoView({
        block: 'nearest', behavior: 'smooth',
      });
    });
  };

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  const handleExport = async () => {
    if (!hasRemitoExportFilters(filters)) {
      toast.error('Aplicá al menos un filtro antes de exportar');
      return;
    }

    setExporting(true);
    try {
      const { blob, filename } = await logisticaApi.exportRemitos(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Listado exportado');
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo exportar el listado');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Remitos</h2>
        <span className="text-sm text-muted-foreground">{pagination.total} en total</span>
      </div>

      <RemitosFiltersBar
        values={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        filterOptions={filterOptions}
        nroRemitoInput={nroInput}
        onNroRemitoInputChange={setNroInput}
        showExport
        exporting={exporting}
        onExport={() => void handleExport()}
      />

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
                    data-remito-id={remito.id}
                    onClick={() => openDetail(remito)}
                    className={`cursor-pointer transition-colors hover:bg-accent/60 ${
                      selectedId === remito.id ? 'bg-primary/[0.08] ring-1 ring-inset ring-primary/20' : ''
                    }`}
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

      {selectedId !== null && (
        <RemitoDetailPanel
          remitoId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={(id) => {
            dispatch(removeRemitoFromList(id));
            setSelectedId(null);
          }}
          index={currentIndex}
          total={list.length}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex < list.length - 1}
          onPrev={() => { const p = list[currentIndex - 1]; if (p) openDetail(p); }}
          onNext={() => { const n = list[currentIndex + 1]; if (n) openDetail(n); }}
        />
      )}
    </div>
  );
}
