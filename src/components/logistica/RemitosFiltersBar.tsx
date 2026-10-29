import { useRef, useState } from 'react';
import { ChevronDown, FileSpreadsheet, Loader2, RotateCcw, Search } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import {
  applyRemitoSortPreset,
  countActiveRemitoFilters,
  detectRemitoSortPreset,
  joinRemitoFilterValues,
  splitRemitoFilterValues,
  type RemitoFilterOptions,
  type RemitoPresenceField,
  type RemitoPresenceState,
  type RemitoSortPreset,
  type RemitosFilterValues,
} from '@/types/remitos-filters.types';

const fieldClass =
  'rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

interface RemitosFiltersBarProps {
  values: RemitosFilterValues;
  onChange: (patch: Partial<RemitosFilterValues>) => void;
  filterOptions: RemitoFilterOptions;
  nroRemitoInput: string;
  onNroRemitoInputChange: (value: string) => void;
  showStatus?: boolean;
  statusOptions?: { value: string; label: string }[];
  showExport?: boolean;
  exporting?: boolean;
  onExport?: () => void;
}

export function RemitosFiltersBar({
  values,
  onChange,
  filterOptions,
  nroRemitoInput,
  onNroRemitoInputChange,
  showStatus = false,
  statusOptions = [],
  showExport = false,
  exporting = false,
  onExport,
}: RemitosFiltersBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clienteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [clienteInput, setClienteInput] = useState(values.cliente ?? '');
  const activeCount = countActiveRemitoFilters(values);

  const patch = (next: Partial<RemitosFilterValues>) => {
    onChange({ ...next, page: 1 });
  };

  const handleSortChange = (preset: RemitoSortPreset) => {
    patch(applyRemitoSortPreset(preset));
  };

  const handleClear = () => {
    onChange({
      page: 1,
      limit: values.limit ?? 20,
      ptoVenta: undefined,
      chofer: undefined,
      uploadedByEmail: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      nroRemito: undefined,
      cliente: undefined,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      presenceField: undefined,
      presenceState: undefined,
      remitoDateFrom: undefined,
      remitoDateTo: undefined,
      annulled: undefined,
    });
    onNroRemitoInputChange('');
    if (clienteDebounceRef.current) clearTimeout(clienteDebounceRef.current);
    setClienteInput('');
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="remitos-filters-panel"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? '' : '-rotate-90'}`} />
          Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={detectRemitoSortPreset(values)}
            onChange={(e) => handleSortChange(e.target.value as RemitoSortPreset)}
            aria-label="Orden"
            className={fieldClass}
          >
            <option value="">Fecha más reciente</option>
            <option value="remito-desc">N° remito: mayor a menor</option>
            <option value="remito-asc">N° remito: menor a mayor</option>
          </select>
          {showExport && onExport && (
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {exporting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FileSpreadsheet className="h-3.5 w-3.5" />}
              Exportar listado
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
      </div>

      {expanded && (
        <div id="remitos-filters-panel" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Prefijo</span>
              <SearchableMultiSelect
                values={splitRemitoFilterValues(values.ptoVenta)}
                options={filterOptions.ptoVentas.map((pv) => ({ value: pv, label: pv }))}
                onChange={(selected) => patch({ ptoVenta: joinRemitoFilterValues(selected) })}
                placeholder="Buscar prefijo…"
                emptyLabel="Todos los prefijos"
              />
            </label>

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Transporte</span>
              <SearchableMultiSelect
                values={splitRemitoFilterValues(values.uploadedByEmail)}
                options={(filterOptions.uploaders ?? []).map((u) => ({ value: u.email, label: u.label }))}
                onChange={(selected) => patch({ uploadedByEmail: joinRemitoFilterValues(selected) })}
                placeholder="Buscar quien subió…"
                emptyLabel="Todos los transportes"
              />
            </label>

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Chofer</span>
              <SearchableMultiSelect
                values={splitRemitoFilterValues(values.chofer)}
                options={filterOptions.choferes.map((name) => ({ value: name, label: name }))}
                onChange={(selected) => patch({ chofer: joinRemitoFilterValues(selected) })}
                placeholder="Buscar chofer…"
                emptyLabel="Todos los choferes"
              />
            </label>

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Cliente</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar cliente…"
                  value={clienteInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClienteInput(v);
                    if (clienteDebounceRef.current) clearTimeout(clienteDebounceRef.current);
                    clienteDebounceRef.current = setTimeout(() => {
                      patch({ cliente: v.trim() || undefined });
                    }, 400);
                  }}
                  className={`${fieldClass} w-full pl-8`}
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">N° remito</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar número…"
                  value={nroRemitoInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    onNroRemitoInputChange(v);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                      patch({ nroRemito: v || undefined });
                    }, 400);
                  }}
                  className={`${fieldClass} w-full pl-8`}
                />
              </div>
            </label>

            {showStatus && (
              <label className="space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-muted-foreground">Estado</span>
                <select
                  value={values.status ?? ''}
                  onChange={(e) => patch({ status: e.target.value || undefined })}
                  className={`${fieldClass} w-full`}
                >
                  <option value="">Todos los estados</option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Subida desde</span>
              <input
                type="date"
                value={values.dateFrom ?? ''}
                onChange={(e) => patch({ dateFrom: e.target.value || undefined })}
                className={`${fieldClass} w-full`}
              />
            </label>

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Subida hasta</span>
              <input
                type="date"
                value={values.dateTo ?? ''}
                onChange={(e) => patch({ dateTo: e.target.value || undefined })}
                className={`${fieldClass} w-full`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Campo OCR</span>
              <select
                value={values.presenceField ?? ''}
                onChange={(e) => patch({ presenceField: (e.target.value || undefined) as RemitoPresenceField | undefined })}
                className={`${fieldClass} w-full`}
              >
                <option value="">Cualquiera</option>
                <option value="firma">Firma</option>
                <option value="aclaracion">Aclaración</option>
                <option value="dni">DNI</option>
              </select>
            </label>

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Detección</span>
              <select
                value={values.presenceState ?? ''}
                onChange={(e) => patch({ presenceState: (e.target.value || undefined) as RemitoPresenceState | undefined })}
                className={`${fieldClass} w-full`}
              >
                <option value="">Todas</option>
                <option value="si">Sí</option>
                <option value="duda">Duda</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Fecha remito desde</span>
              <input
                type="date"
                value={values.remitoDateFrom ?? ''}
                onChange={(e) => patch({ remitoDateFrom: e.target.value || undefined })}
                className={`${fieldClass} w-full`}
              />
            </label>

            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Fecha remito hasta</span>
              <input
                type="date"
                value={values.remitoDateTo ?? ''}
                onChange={(e) => patch({ remitoDateTo: e.target.value || undefined })}
                className={`${fieldClass} w-full`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Anulados</span>
              <select
                value={values.annulled ?? ''}
                onChange={(e) => patch({ annulled: (e.target.value || undefined) as RemitosFilterValues['annulled'] })}
                className={`${fieldClass} w-full`}
              >
                <option value="">Todos</option>
                <option value="only">Solo anulados</option>
                <option value="exclude">Excluir anulados</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
