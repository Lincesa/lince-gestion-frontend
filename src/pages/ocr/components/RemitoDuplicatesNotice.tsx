import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import type { RemitoDuplicate, RemitoDuplicateReason } from '@/types/ocr.types';

const REASON_LABELS: Record<RemitoDuplicateReason, string> = {
  same_file: 'Misma foto, subida desde otra cuenta',
  same_number: 'Mismo número (leído por OCR)',
};

const uploadDateFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});

export function formatDuplicateNumber(dup: Pick<RemitoDuplicate, 'ptoVenta' | 'nroRemito'>): string {
  if (!dup.nroRemito) return 'Sin número';
  return dup.ptoVenta ? `${dup.ptoVenta}-${dup.nroRemito}` : dup.nroRemito;
}

/** Small row flag for the remitos list. */
export function DuplicateBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-sans text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      title={count === 1 ? 'Hay otro remito que podría ser el mismo' : `Hay ${count} remitos que podrían ser el mismo`}
    >
      <Copy className="h-3 w-3" aria-hidden />
      Posible duplicado
    </span>
  );
}

interface NoticeProps {
  duplicates: RemitoDuplicate[];
  /** Times the same account sent this exact photo again (each retry was rejected). */
  duplicateAttempts: number;
  onOpen: (id: string) => void;
}

/** Warns the operator about remitos that may be this same one, so they can compare and remove one. */
export function RemitoDuplicatesNotice({ duplicates, duplicateAttempts, onOpen }: NoticeProps) {
  if (duplicates.length === 0 && duplicateAttempts <= 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
      {duplicates.length > 0 && (
        <>
          <p className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-100">
            <Copy className="h-4 w-4" aria-hidden />
            Posible duplicado
          </p>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
            Compará las fotos. Si es el mismo remito, anulá o eliminá el que no corresponda.
          </p>
          <ul className="space-y-2">
            {duplicates.map((dup) => (
              <li
                key={dup.id}
                className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-background p-2 dark:border-amber-800/60"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-mono text-sm text-foreground">
                    {formatDuplicateNumber(dup)}
                    {dup.fecha && <span className="ml-2 font-sans text-xs text-muted-foreground">{dup.fecha}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Subido {uploadDateFormat.format(new Date(dup.createdAt))}
                    {' por '}
                    {[dup.driverName, dup.uploadedByName].filter(Boolean).join(' · ') || 'usuario desconocido'}
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {dup.reasons.map((reason) => REASON_LABELS[reason]).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(dup.id)}
                  className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {duplicateAttempts > 0 && (
        <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
          La misma foto se intentó subir {duplicateAttempts} {duplicateAttempts === 1 ? 'vez' : 'veces'} más
          desde la misma cuenta; esos envíos se descartaron solos.
        </p>
      )}
    </div>
  );
}

interface SectionProps {
  id: string;
  duplicateAttempts: number;
  fetchDuplicates: (id: string) => Promise<RemitoDuplicate[]>;
  onOpen: (id: string) => void;
}

/** Loads the possible duplicates of a remito and shows the notice when there are any. */
export function RemitoDuplicatesSection({ id, duplicateAttempts, fetchDuplicates, onOpen }: SectionProps) {
  const [loaded, setLoaded] = useState<{ id: string; duplicates: RemitoDuplicate[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDuplicates(id)
      .then((duplicates) => { if (!cancelled) setLoaded({ id, duplicates }); })
      // Only a warning: if it cannot load, the remito still works as usual.
      .catch(() => { if (!cancelled) setLoaded({ id, duplicates: [] }); });
    return () => { cancelled = true; };
  }, [id, fetchDuplicates]);

  const duplicates = loaded?.id === id ? loaded.duplicates : [];
  return <RemitoDuplicatesNotice duplicates={duplicates} duplicateAttempts={duplicateAttempts} onOpen={onOpen} />;
}
