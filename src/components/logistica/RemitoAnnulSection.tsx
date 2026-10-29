import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AnnulInfo } from '@/utils/remitoAnnul';
import { RemitoAnnulBanner } from './RemitoAnnulBanner';
import { RemitoAnnulDialog, type AnnulDialogMode } from './RemitoAnnulDialog';

interface Props {
  remito:     AnnulInfo & { id: string };
  canManage:  boolean;
  /** OCR or logistica endpoint depending on the host view. */
  annul:      (id: string, reason: string) => Promise<unknown>;
  unannul:    (id: string) => Promise<unknown>;
  /** Called after a successful void / unvoid so the host refreshes its detail and list. */
  onChanged:  () => void;
  /** Lets the host skip its own Escape handling while the dialog is open. */
  onDialogOpenChange?: (open: boolean) => void;
}

/** Container: void banner + Anular / Desanular actions with their confirmation dialog. */
export function RemitoAnnulSection({
  remito,
  canManage,
  annul,
  unannul,
  onChanged,
  onDialogOpenChange,
}: Props) {
  const [mode, setMode] = useState<AnnulDialogMode | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onDialogOpenChange?.(mode !== null);
  }, [mode, onDialogOpenChange]);

  // Unmounting with the dialog open must not leave the host's Escape guard stuck.
  useEffect(() => () => onDialogOpenChange?.(false), [onDialogOpenChange]);

  // Moving to another remito closes any open dialog.
  useEffect(() => {
    setMode(null);
    setBusy(false);
  }, [remito.id]);

  const close = useCallback(() => setMode(null), []);

  const handleConfirm = async (reason: string) => {
    if (!mode) return;
    setBusy(true);
    try {
      if (mode === 'annul') {
        await annul(remito.id, reason);
        toast.success('Remito anulado');
      } else {
        await unannul(remito.id);
        toast.success('Remito desanulado');
      }
      setMode(null);
      onChanged();
    } catch (err) {
      toast.error((err as Error)?.message || 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RemitoAnnulBanner
        remito={remito}
        canManage={canManage}
        onAnnul={() => setMode('annul')}
        onUnannul={() => setMode('unannul')}
      />
      {mode && (
        <RemitoAnnulDialog
          key={mode}
          mode={mode}
          busy={busy}
          onCancel={close}
          onConfirm={(reason) => void handleConfirm(reason)}
        />
      )}
    </>
  );
}
