/**
 * RemitoAnnulDialog — diálogo chico para anular (motivo obligatorio) o desanular un remito.
 * Escape closes only this dialog: hosts skip their own Escape handling while it is open.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ANNUL_REASON_MAX } from '@/utils/remitoAnnul';

export type AnnulDialogMode = 'annul' | 'unannul';

interface Props {
  mode:      AnnulDialogMode;
  busy:      boolean;
  onCancel:  () => void;
  /** Receives the trimmed reason in 'annul' mode, an empty string in 'unannul' mode. */
  onConfirm: (reason: string) => void;
}

export function RemitoAnnulDialog({ mode, busy, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const titleId = useId();
  const reasonId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const isAnnul = mode === 'annul';
  const canConfirm = !busy && (!isAnnul || reason.trim().length > 0);

  // Focus the first useful control and give focus back to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (isAnnul ? reasonRef.current : confirmRef.current)?.focus();
    return () => previous?.focus?.();
  }, [isAnnul]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [busy, onCancel]);

  const confirm = () => {
    if (canConfirm) onConfirm(isAnnul ? reason.trim() : '');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <div className="space-y-1">
          <h3 id={titleId} className="text-base font-semibold text-foreground">
            {isAnnul ? 'Anular remito' : '¿Desanular el remito?'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAnnul
              ? 'El remito queda marcado como anulado en OCR y Logística. Se puede deshacer.'
              : 'El remito vuelve a figurar como vigente y se borra el motivo de anulación.'}
          </p>
        </div>

        {isAnnul && (
          <label htmlFor={reasonId} className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Motivo</span>
            <textarea
              id={reasonId}
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  confirm();
                }
              }}
              maxLength={ANNUL_REASON_MAX}
              rows={3}
              required
              disabled={busy}
              placeholder="Por qué se anula este remito"
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <span className="block text-right text-[11px] text-muted-foreground">
              {reason.length}/{ANNUL_REASON_MAX}
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${
              isAnnul
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isAnnul ? 'Anular' : 'Desanular'}
          </button>
        </div>
      </div>
    </div>
  );
}
