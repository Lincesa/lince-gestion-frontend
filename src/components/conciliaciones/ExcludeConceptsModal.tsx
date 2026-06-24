import { useMemo, useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { conciliacionesApi } from '@/api/conciliaciones';
import { groupConceptVariants, normConcept } from '@/utils/conciliaciones';
import type { ExtractLine, ExpenseCategory } from '@/types/conciliaciones.types';

interface ExcludeConceptsModalProps {
  open: boolean;
  onClose: () => void;
  extractLines: ExtractLine[];
  excludeConcepts: string[];
  runId: string;
  onExcludeConcepts: (concepts: string[]) => Promise<void>;
  onExcludeByCategory: (categoryId: string) => Promise<void>;
  onSuccess: () => void;
}

export function ExcludeConceptsModal({
  open,
  onClose,
  extractLines,
  excludeConcepts,
  onExcludeConcepts,
  onExcludeByCategory,
  onSuccess,
}: ExcludeConceptsModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryToExclude, setCategoryToExclude] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState(false);

  const excludedSet = useMemo(() => new Set(excludeConcepts.map(normConcept)), [excludeConcepts]);

  const conceptOptions = useMemo(() => {
    const active = extractLines.filter((l) => !l.excluded);
    const rawConcepts: string[] = [];
    const categoryByKey = new Map<string, string | null>();
    const countByKey = new Map<string, number>();
    for (const l of active) {
      const c = (l.concept ?? '').trim();
      if (!c) continue;
      const key = normConcept(c);
      if (excludedSet.has(key)) continue;
      rawConcepts.push(c);
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
      if (!categoryByKey.get(key) && l.category?.name) categoryByKey.set(key, l.category.name);
    }
    return groupConceptVariants(rawConcepts).map((g) => ({
      ...g,
      categoryName: categoryByKey.get(g.key) ?? null,
      count: countByKey.get(g.key) ?? 0,
    }));
  }, [extractLines, excludedSet]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conceptOptions;
    const q = normConcept(search);
    return conceptOptions.filter(
      (o) =>
        normConcept(o.label).includes(q) ||
        o.variants.some((v) => normConcept(v).includes(q)) ||
        (o.categoryName && normConcept(o.categoryName).includes(q)),
    );
  }, [conceptOptions, search]);

  useEffect(() => {
    if (open) conciliacionesApi.listCategories().then(setCategories).catch(() => setCategories([]));
  }, [open]);

  useEffect(() => {
    if (!open) { setSearch(''); setSelected(new Set()); setCategoryToExclude(''); }
  }, [open]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleExcludeSelected = async () => {
    if (selected.size === 0) return;
    const concepts = conceptOptions
      .filter((o) => selected.has(o.key))
      .flatMap((o) => o.variants);
    setLoading(true);
    try {
      await onExcludeConcepts(concepts);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al excluir conceptos');
    } finally {
      setLoading(false);
    }
  };

  const handleExcludeByCategory = async () => {
    if (!categoryToExclude) return;
    setLoadingCategory(true);
    try {
      await onExcludeByCategory(categoryToExclude);
      onSuccess();
      setCategoryToExclude('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al excluir por categoría');
    } finally {
      setLoadingCategory(false);
    }
  };

  const busy = loading || loadingCategory;

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title="Excluir conceptos" description="Buscá conceptos del extracto y excluilos, o excluí por categoría.">
      <div className="space-y-4 max-h-[70vh] overflow-hidden flex flex-col relative">
        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">{loading ? `Excluyendo ${selected.size} concepto(s)...` : 'Excluyendo por categoría...'}</p>
            </div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por concepto o categoría..." className="pl-9" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{filtered.length} concepto(s) disponibles{search.trim() && ` (filtrado por "${search}")`}</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(filtered.map((o) => o.key)))}>Seleccionar todos</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Quitar selección</Button>
          </div>
        </div>
        <div className="border rounded-md overflow-auto min-h-[120px] max-h-[220px]">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No hay conceptos para excluir.</p>
          ) : (
            <ul className="p-1 divide-y">
              {filtered.map((o) => (
                <li key={o.key} className="flex items-center gap-3 py-2 px-2 hover:bg-muted/50 rounded">
                  <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} className="h-4 w-4 rounded border-input" />
                  <span className="flex-1 truncate text-sm" title={o.label}>{o.label}</span>
                  {o.categoryName && <span className="text-xs text-muted-foreground shrink-0">{o.categoryName}</span>}
                  {o.count > 1 && <span className="text-xs text-muted-foreground tabular-nums">×{o.count}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {categories.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <p className="text-sm font-medium">Excluir por categoría (reglas)</p>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={categoryToExclude} onChange={(e) => setCategoryToExclude(e.target.value)} className="w-56">
                <option value="">Seleccionar categoría...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Button size="sm" variant="outline" disabled={!categoryToExclude || loadingCategory} onClick={handleExcludeByCategory}>
                {loadingCategory ? 'Excluyendo...' : 'Excluir todos esta categoría'}
              </Button>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cerrar</Button>
          <Button disabled={selected.size === 0 || loading} onClick={handleExcludeSelected}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluyendo...</> : `Excluir seleccionados (${selected.size})`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
