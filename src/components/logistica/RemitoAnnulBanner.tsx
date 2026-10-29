/**
 * RemitoAnnulBanner — banner rojo "Remito anulado" con motivo, autor y fecha,
 * más las acciones Anular / Desanular cuando el usuario puede usarlas.
 */
import { Ban, RotateCcw } from 'lucide-react';
import { describeAnnulment, isRemitoAnnulled, type AnnulInfo } from '@/utils/remitoAnnul';

interface Props {
  remito:     AnnulInfo;
  canManage:  boolean;
  onAnnul:    () => void;
  onUnannul:  () => void;
}

const actionFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function RemitoAnnulBanner({ remito, canManage, onAnnul, onUnannul }: Props) {
  if (!isRemitoAnnulled(remito)) {
    if (!canManage) return null;
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAnnul}
          className={`inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-destructive/10 dark:text-red-300 ${actionFocus}`}
        >
          <Ban className="h-3.5 w-3.5" />
          Anular remito
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-destructive/40 border-l-4 border-l-destructive bg-destructive/10 px-4 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">Remito anulado</p>
            {remito.annulReason && (
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{remito.annulReason}</p>
            )}
            <p className="text-xs text-muted-foreground">{describeAnnulment(remito)}</p>
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onUnannul}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent ${actionFocus}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Desanular
          </button>
        )}
      </div>
    </div>
  );
}
