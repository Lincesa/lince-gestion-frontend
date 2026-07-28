import { useEffect, useState, useMemo } from 'react';
import { Plus, Download, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';
import { fetchCustomers, deleteCustomer } from '@/store/crm/clientsSlice';
import { exportCustomersExcel } from '@/api/crm';
import type { Customer } from '@/types/crm.types';
import { ClientFormModal } from '@/components/crm/ClientFormModal';

const PAGE_SIZE = 20;

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  DERIVADO_A_DISTRIBUIDOR: 'Derivado',
  NO_CONTESTO: 'No contestó',
  SE_COTIZO_Y_PENDIENTE: 'Cotizado',
  SE_COTIZO_Y_NO_INTERESO: 'Sin interés',
  COMPRO: 'Compró',
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200',
  DERIVADO_A_DISTRIBUIDOR: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  NO_CONTESTO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200',
  SE_COTIZO_Y_PENDIENTE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200',
  SE_COTIZO_Y_NO_INTERESO: 'bg-muted text-muted-foreground',
  COMPRO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
};

type SortKey = 'nombre' | 'createdAt' | 'estado';
type SortDir = 'asc' | 'desc';

export function ClientsPage() {
  const dispatch = useAppDispatch();
  const { list: customers, loading, error } = useAppSelector((s) => s.clients);
  const { canEdit, canAdmin } = useCanPerform(ModuleKey.CRM);

  const [search, setSearch] = useState('');
  const [filterSiguiendo, setFilterSiguiendo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterReconsulta, setFilterReconsulta] = useState<'all' | 'reconsulta' | 'primera'>('all');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [modalCustomer, setModalCustomer] = useState<Customer | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void dispatch(fetchCustomers());
  }, [dispatch]);

  const filtered = useMemo(() => {
    let list = [...customers];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        [c.nombre, c.apellido, c.telefono, c.producto, c.ubicacion?.provincia]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }

    if (filterSiguiendo) list = list.filter((c) => c.siguiendo === filterSiguiendo);
    if (filterEstado) list = list.filter((c) => c.estado === filterEstado);
    if (filterReconsulta === 'reconsulta') list = list.filter((c) => c.isReconsulta);
    if (filterReconsulta === 'primera') list = list.filter((c) => !c.isReconsulta);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'nombre') {
        cmp = ((a.nombre ?? '') + (a.apellido ?? '')).localeCompare((b.nombre ?? '') + (b.apellido ?? ''));
      } else if (sortKey === 'createdAt') {
        cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      } else if (sortKey === 'estado') {
        cmp = (a.estado ?? '').localeCompare(b.estado ?? '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [customers, search, filterSiguiendo, filterEstado, filterReconsulta, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  function SortIndicator({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="ml-1 text-muted-foreground/40">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  async function handleExport() {
    setExporting(true);
    try { await exportCustomersExcel(); }
    finally { setExporting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dispatch(deleteCustomer(deleteTarget.id)).unwrap();
      toast.success('Cliente eliminado');
      setDeleteTarget(null);
    } catch {
      toast.error('Error al eliminar cliente');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Clientes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={() => setModalCustomer(null)}
            disabled={!canEdit}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, teléfono, producto, provincia..."
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={filterSiguiendo}
          onChange={(e) => { setFilterSiguiendo(e.target.value); setPage(1); }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los asesores</option>
          <option value="EZEQUIEL">Ezequiel</option>
          <option value="DENIS">Denis</option>
          <option value="MARTIN">Martín</option>
          <option value="JULIAN">Julián</option>
          <option value="SIN_ASIGNAR">Sin asignar</option>
        </select>

        <select
          value={filterEstado}
          onChange={(e) => { setFilterEstado(e.target.value); setPage(1); }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="DERIVADO_A_DISTRIBUIDOR">Derivado</option>
          <option value="NO_CONTESTO">No contestó</option>
          <option value="SE_COTIZO_Y_PENDIENTE">Cotizado pendiente</option>
          <option value="SE_COTIZO_Y_NO_INTERESO">Sin interés</option>
          <option value="COMPRO">Compró</option>
        </select>

        <div className="flex rounded-md border border-border overflow-hidden text-sm">
          {(['all', 'primera', 'reconsulta'] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setFilterReconsulta(v); setPage(1); }}
              className={[
                'px-3 py-1.5',
                filterReconsulta === v
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
            >
              {v === 'all' ? 'Todos' : v === 'primera' ? 'Primeras consultas' : 'Reconsultas'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse bg-muted rounded" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <p className="text-sm text-destructive mb-2">Error al cargar clientes.</p>
          <button onClick={() => void dispatch(fetchCustomers())} className="text-sm text-primary hover:underline">
            Reintentar
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('nombre')}>
                    Nombre <SortIndicator k="nombre" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Teléfono</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Producto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('estado')}>
                    Estado <SortIndicator k="estado" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Asesor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Provincia</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('createdAt')}>
                    Fecha <SortIndicator k="createdAt" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No se encontraron clientes.
                    </td>
                  </tr>
                ) : (
                  paginated.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setModalCustomer(c)}>
                      <td className="px-4 py-2.5 text-foreground">
                        {[c.nombre, c.apellido].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.telefono}</td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[140px]">
                        <span className="truncate block" title={c.producto}>{c.producto ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {c.estado ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[c.estado] ?? 'bg-muted text-muted-foreground'}`}>
                            {ESTADO_LABELS[c.estado] ?? c.estado}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.siguiendo ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.ubicacion?.provincia ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        {c.isReconsulta
                          ? <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">Reconsulta</span>
                          : <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">Primera</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <button onClick={() => setModalCustomer(c)} className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground" title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canAdmin && (
                            <button onClick={() => setDeleteTarget(c)} className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} · Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCustomer !== undefined && (
        <ClientFormModal
          customer={modalCustomer}
          onClose={() => setModalCustomer(undefined)}
          readOnly={!canEdit}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg w-full max-w-sm mx-4 p-6 shadow-lg">
            <h3 className="text-base font-semibold text-foreground mb-2">Eliminar cliente</h3>
            <p className="text-sm text-muted-foreground mb-6">
              ¿Confirmar la eliminación de{' '}
              <span className="font-medium text-foreground">
                {[deleteTarget.nombre, deleteTarget.apellido].filter(Boolean).join(' ') || deleteTarget.telefono}
              </span>
              ? Esta acción no se puede deshacer.
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
