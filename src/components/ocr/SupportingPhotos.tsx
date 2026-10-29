/**
 * SupportingPhotos — galería de solo lectura con las fotos de respaldo de un remito
 * (remito de planta, ticket de pesaje, descarga). Estas fotos nunca pasan por el OCR.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Images, Loader2, Maximize2 } from 'lucide-react';
import type { OcrAttachment } from '@/types/ocr.types';
import { FilePreviewModal } from '@/pages/ocr/components/FilePreviewModal';

interface Props {
  attachments:          OcrAttachment[];
  loading:              boolean;
  error:                string | null;
  /** Lets the host skip its own Escape handling while the full-size view is open. */
  onPreviewOpenChange?: (open: boolean) => void;
}

export function SupportingPhotos({ attachments, loading, error, onPreviewOpenChange }: Props) {
  const [selected, setSelected] = useState<OcrAttachment | null>(null);

  useEffect(() => {
    onPreviewOpenChange?.(selected !== null);
  }, [selected, onPreviewOpenChange]);

  // Unmounting with the viewer open must not leave the host's Escape guard stuck.
  useEffect(() => () => onPreviewOpenChange?.(false), [onPreviewOpenChange]);

  // A new list (another remito, or a refetch) invalidates the open photo.
  useEffect(() => {
    setSelected(null);
  }, [attachments]);

  return (
    <section className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <Images className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium text-muted-foreground">Documentación de respaldo</h3>
        {!loading && !error && attachments.length > 0 && (
          <span className="text-xs text-muted-foreground">({attachments.length})</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando documentación de respaldo…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          No se pudo cargar la documentación de respaldo.
        </div>
      ) : attachments.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">Sin documentación de respaldo</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {attachments.map((attachment, i) => (
            <li key={attachment.id}>
              <button
                type="button"
                onClick={() => setSelected(attachment)}
                title="Ver en tamaño completo"
                className="group relative block aspect-square w-full overflow-hidden rounded-md border border-border bg-muted/40 transition-opacity hover:opacity-90"
              >
                <img
                  src={attachment.viewUrl}
                  alt={`Foto de respaldo ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 className="h-4 w-4 text-white" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Sin documentId: el visor queda en solo lectura (no persiste rotaciones). */}
      {selected && (
        <FilePreviewModal
          url={selected.viewUrl}
          isPdf={selected.contentType === 'application/pdf'}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
