import { describeAnnulment, type AnnulInfo } from '@/utils/remitoAnnul';

/** Small "Anulado" pill for list rows; the reason, author and date go in the tooltip. */
export function RemitoAnnulledBadge({ remito }: { remito: AnnulInfo }) {
  const title = [remito.annulReason, describeAnnulment(remito)].filter(Boolean).join(' — ');
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 font-sans text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-200"
    >
      Anulado
    </span>
  );
}
