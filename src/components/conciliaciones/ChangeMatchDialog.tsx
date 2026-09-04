import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { conciliacionesApi } from '@/api/conciliaciones';
import type { ExtractLine, OriginalMatchReference, SystemLine } from '@/types/conciliaciones.types';
import { formatCalendarDate } from '@/utils/conciliaciones';

interface ChangeMatchDialogProps {
  open: boolean;
  onClose: () => void;
  runId: string;
  systemLines: SystemLine[];
  extractLines: ExtractLine[];
  currentSystemIds: string[];
  currentExtractIds: string[];
  originalMatch?: OriginalMatchReference;
  blockedSystemIds?: Set<string>;
  blockedExtractIds?: Set<string>;
  onSuccess: () => void;
}

export function ChangeMatchDialog({
  open,
  onClose,
  runId,
  systemLines,
  extractLines,
  currentSystemIds,
  currentExtractIds,
  originalMatch,
  blockedSystemIds = new Set(),
  blockedExtractIds = new Set(),
  onSuccess,
}: ChangeMatchDialogProps) {
  const [selectedSystemIds, setSelectedSystemIds] = useState<Set<string>>(new Set(currentSystemIds));
  const [selectedExtractIds, setSelectedExtractIds] = useState<Set<string>>(new Set(currentExtractIds));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedSystemIds(new Set(currentSystemIds));
    setSelectedExtractIds(new Set(currentExtractIds));
  }, [open, currentSystemIds, currentExtractIds]);

  const availableSystems = useMemo(() => {
    const current = new Set(currentSystemIds);
    return systemLines.filter((line) => current.has(line.id) || !blockedSystemIds.has(line.id));
  }, [systemLines, currentSystemIds, blockedSystemIds]);

  const availableExtracts = useMemo(() => {
    const current = new Set(currentExtractIds);
    return extractLines.filter((line) => current.has(line.id) || !blockedExtractIds.has(line.id));
  }, [extractLines, currentExtractIds, blockedExtractIds]);

  const systemSum = useMemo(() => {
    let sum = 0;
    selectedSystemIds.forEach((id) => {
      const line = availableSystems.find((system) => system.id === id);
      if (line) sum += line.amount;
    });
    return sum;
  }, [selectedSystemIds, availableSystems]);

  const extractSum = useMemo(() => {
    let sum = 0;
    selectedExtractIds.forEach((id) => {
      const line = availableExtracts.find((extract) => extract.id === id);
      if (line) sum += line.amount;
    });
    return sum;
  }, [selectedExtractIds, availableExtracts]);

  const difference = extractSum - systemSum;
  const isValid = selectedSystemIds.size > 0 && selectedExtractIds.size > 0 && Math.abs(difference) <= 0.01;

  const toggleSystem = (id: string) => {
    const next = new Set(selectedSystemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSystemIds(next);
  };

  const toggleExtract = (id: string) => {
    const next = new Set(selectedExtractIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedExtractIds(next);
  };

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error('Las sumas de sistema y extracto deben coincidir');
      return;
    }
    setLoading(true);
    try {
      await conciliacionesApi.setMatch(
        runId,
        Array.from(selectedSystemIds),
        Array.from(selectedExtractIds),
        originalMatch,
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Cambiar match" panelClassName="!max-w-7xl max-h-[90vh] overflow-hidden">
      <div className="flex max-h-[calc(90vh-7rem)] flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Seleccioná una o más filas de sistema y una o más filas de extracto. Ambas sumas deben coincidir.
        </p>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Sistema</h4>
              <span className="text-xs text-muted-foreground">${systemSum.toFixed(2)}</span>
            </div>
            <div className="max-h-[58vh] overflow-auto rounded-md border">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 p-2"></th>
                    <th className="p-2 text-left">Descripción</th>
                    <th className="w-36 p-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {availableSystems.map((system) => (
                    <tr key={system.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => toggleSystem(system.id)}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedSystemIds.has(system.id)}
                          onChange={() => toggleSystem(system.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-input"
                        />
                      </td>
                      <td className="p-2">{system.description || '-'}</td>
                      <td className="whitespace-nowrap p-2 text-right">${system.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Extracto</h4>
              <span className="text-xs text-muted-foreground">${extractSum.toFixed(2)}</span>
            </div>
            <div className="max-h-[58vh] overflow-auto rounded-md border">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 p-2"></th>
                    <th className="w-28 p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Concepto</th>
                    <th className="w-36 p-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {availableExtracts.map((extract) => (
                    <tr key={extract.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => toggleExtract(extract.id)}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedExtractIds.has(extract.id)}
                          onChange={() => toggleExtract(extract.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-input"
                        />
                      </td>
                      <td className="whitespace-nowrap p-2">{formatCalendarDate(extract.date)}</td>
                      <td className="p-2">{extract.concept || '-'}</td>
                      <td className="whitespace-nowrap p-2 text-right">${extract.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-sm">
            Diferencia: <strong className={isValid ? 'text-green-700 dark:text-green-200' : 'text-destructive'}>${difference.toFixed(2)}</strong>
            {isValid && <span className="ml-2 text-green-700 dark:text-green-200">✓ Coincide</span>}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!isValid || loading}>{loading ? 'Guardando...' : 'Guardar match'}</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
