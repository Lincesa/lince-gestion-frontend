import { useRef } from 'react';
import { FileSpreadsheet, Loader2, RotateCcw, Search } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { UPLOADER_CHIPS } from '@/constants/uploaderChips';
import {
  applyRemitoSortPreset,
  detectRemitoSortPreset,
  type RemitoFilterOptions,
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
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
    onNroRemitoInputChange('');
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Filtros</p>
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Prefijo</span>
          <SearchableSelect
            value={values.ptoVenta}
            options={filterOptions.ptoVentas.map((pv) => ({ value: pv, label: pv }))}
            onChange={(v) => patch({ ptoVenta: v })}
            placeholder="Buscar prefijo…"
            emptyLabel="Todos los prefijos"
          />
        </label>

        <label className="space-y-1.5 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Transporte</span>
          <select
            value={values.uploadedByEmail ?? ''}
            onChange={(e) => patch({ uploadedByEmail: e.target.value || undefined })}
            className={`${fieldClass} w-full`}
          >
            <option value="">Todos los transportes</option>
            {UPLOADER_CHIPS.map((chip) => (
              <option key={chip.email} value={chip.email}>{chip.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Chofer</span>
          <SearchableSelect
            value={values.chofer}
            options={filterOptions.choferes.map((name) => ({ value: name, label: name }))}
            onChange={(v) => patch({ chofer: v })}
            placeholder="Buscar chofer…"
            emptyLabel="Todos los choferes"
          />
        </label>

        <label className="space-y-1.5 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Orden</span>
          <select
            value={detectRemitoSortPreset(values)}
            onChange={(e) => handleSortChange(e.target.value as RemitoSortPreset)}
            className={`${fieldClass} w-full`}
          >
            <option value="">Fecha más reciente</option>
            <option value="remito-desc">N° remito: mayor a menor</option>
            <option value="remito-asc">N° remito: menor a mayor</option>
          </select>
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
    </div>
  );
}
