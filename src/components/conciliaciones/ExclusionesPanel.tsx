import { useState, useEffect, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ExcludeConceptsModal } from './ExcludeConceptsModal';
import { conciliacionesApi } from '@/api/conciliaciones';
import type { ExcludedSummaryRow, ExtractLine, ExpenseCategory } from '@/types/conciliaciones.types';

import { normConcept } from '@/utils/conciliaciones';

interface ExclusionesPanelProps {
  excludeConcepts: string[];
  extractLines: ExtractLine[];
  excludedSummary: ExcludedSummaryRow[];
  canEdit: boolean;
  isClosed: boolean;
  runId?: string;
  onRemoveExcludedConcept?: (concept: string) => Promise<void>;
  onExcludeConcepts?: (concepts: string[]) => Promise<void>;
  onExcludeByCategory?: (categoryId: string) => Promise<void>;
  onSuccess?: () => void;
}

export function ExclusionesPanel({ excludeConcepts, extractLines, excludedSummary, canEdit, isClosed, runId, onRemoveExcludedConcept, onExcludeConcepts, onExcludeByCategory, onSuccess }: ExclusionesPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  useEffect(() => {
    if (excludeConcepts.length > 0) {
      conciliacionesApi.listCategories().then(setCategories).catch(() => setCategories([]));
    } else {
      setCategories([]);
    }
  }, [excludeConcepts.length]);

  const categoryNamesSet = useMemo(() => new Set(categories.map((c) => normConcept(c.name))), [categories]);

  const canAdd = canEdit && !isClosed && runId && onExcludeConcepts && onExcludeByCategory && onSuccess;
  const canRemove = canEdit && !isClosed && onRemoveExcludedConcept;
  const excludedTotal = excludedSummary.reduce((sum, row) => sum + row.total, 0);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  const handleRemove = async (concept: string) => {
    if (!onRemoveExcludedConcept) return;
    setRemoving(concept);
    try {
      await onRemoveExcludedConcept(concept);
      onSuccess?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo quitar la exclusión');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reglas en uso (exclusiones)</CardTitle>
          <CardDescription>Conceptos o categorías excluidos de listas y conteos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {excludeConcepts.length > 0 ? (
            <ul className="space-y-2">
              {excludeConcepts.map((c) => {
                const isRemoving = removing === c;
                return (
                  <li key={c} className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${isRemoving ? 'bg-muted/60 opacity-80' : 'bg-muted/30'}`}>
                    <span className="text-sm font-medium truncate">
                      {c}
                      {categoryNamesSet.has(normConcept(c)) && <span className="text-muted-foreground font-normal"> (categoría)</span>}
                    </span>
                    {canRemove && (
                      <Button variant="ghost" size="sm" className="shrink-0 h-8 gap-1.5" disabled={removing !== null} onClick={() => void handleRemove(c)} title="Quitar esta exclusión">
                        {isRemoving ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Quitando...</span></> : <X className="h-4 w-4" />}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No hay reglas de exclusión.</p>
          )}
          {canAdd ? (
            <Button onClick={() => setModalOpen(true)}>Excluir concepto(s)</Button>
          ) : isClosed ? (
            <p className="text-sm text-muted-foreground">La conciliación está cerrada.</p>
          ) : !canEdit ? (
            <p className="text-sm text-muted-foreground">Solo quien edita puede agregar exclusiones.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de conceptos excluidos</CardTitle>
          <CardDescription>
            Totalizado con el mismo criterio del Excel: movimientos excluidos y reglas aplicadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {excludedSummary.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Conceptos</p>
                  <p className="text-lg font-semibold">{excludedSummary.length}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Movimientos</p>
                  <p className="text-lg font-semibold">{excludedSummary.reduce((sum, row) => sum + row.count, 0)}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Importe total</p>
                  <p className="text-lg font-semibold">{formatCurrency(excludedTotal)}</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Concepto</th>
                      <th className="px-3 py-2 text-left font-medium">Categoría</th>
                      <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                      <th className="px-3 py-2 text-right font-medium">Importe total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excludedSummary.map((row) => (
                      <tr key={`${row.concept}-${row.category}`} className="border-t">
                        <td className="px-3 py-2 font-medium">{row.concept}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category || '-'}</td>
                        <td className="px-3 py-2 text-right">{row.count}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay conceptos excluidos para resumir.</p>
          )}
        </CardContent>
      </Card>

      {canAdd && runId && onExcludeConcepts && onExcludeByCategory && onSuccess && (
        <ExcludeConceptsModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          extractLines={extractLines}
          excludeConcepts={excludeConcepts}
          runId={runId}
          onExcludeConcepts={onExcludeConcepts}
          onExcludeByCategory={onExcludeByCategory}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
