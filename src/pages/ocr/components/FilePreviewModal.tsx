/**
 * FilePreviewModal — visor de archivos a pantalla completa.
 * Soporta imágenes (zoom, arrastre, rotación persistente) y PDFs (via <iframe>).
 * Se monta en document.body para no quedar recortado por el layout (header/overflow).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X, FileText, ZoomIn, ZoomOut, RotateCcw, RotateCw, Save, Loader2 } from 'lucide-react';
import * as ocrApi from '@/api/ocr';
import {
  getRotatedImageContentType,
  normalizeRotation,
  prepareImageBlobForUpload,
  type RotationDegrees,
} from '@/utils/image-rotate';

export interface PersistRotationApi {
  downloadFile: (id: string) => Promise<Blob>;
  requestReplaceUploadUrl: (
    id: string,
    contentType: 'image/jpeg' | 'image/png' | 'image/webp',
  ) => Promise<{ uploadUrl: string }>;
  confirmReplace: (id: string) => Promise<{ viewUrl: string | null }>;
  uploadToS3?: (
    uploadUrl: string,
    file: Blob,
    contentType: string,
  ) => Promise<void>;
}

interface Props {
  url:          string;
  isPdf:        boolean;
  documentId?:  string;
  persistApi?:  PersistRotationApi;
  onClose:      () => void;
  onRotated?:   (viewUrl: string) => void;
}

const DEFAULT_PERSIST_API: PersistRotationApi = {
  downloadFile:            ocrApi.downloadDocumentFile,
  requestReplaceUploadUrl: ocrApi.requestReplaceUploadUrl,
  confirmReplace:          ocrApi.confirmReplace,
  uploadToS3:              ocrApi.uploadToS3,
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

export function FilePreviewModal({
  url,
  isPdf,
  documentId,
  persistApi = DEFAULT_PERSIST_API,
  onClose,
  onRotated,
}: Props) {
  const [scale, setScale]           = useState(1);
  const [offset, setOffset]         = useState({ x: 0, y: 0 });
  const [rotation, setRotation]     = useState<RotationDegrees>(0);
  const [displayUrl, setDisplayUrl] = useState(url);
  const [saving, setSaving]         = useState(false);
  const [dragging, setDragging]     = useState(false);
  const containerRef  = useRef<HTMLDivElement>(null);
  const dragStart     = useRef({ x: 0, y: 0 });
  const offsetAtDrag  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setDisplayUrl(url);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  }, [url]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isPdf) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setScale(prev => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
        if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isPdf]);

  const zoomBy = (delta: number) => {
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const rotateBy = (delta: 90 | -90) => {
    setRotation(prev => normalizeRotation(prev + delta));
    setOffset({ x: 0, y: 0 });
  };

  const handleSaveRotation = async () => {
    if (!documentId || isPdf || rotation === 0 || saving) return;

    setSaving(true);
    try {
      const sourceBlob = await persistApi.downloadFile(documentId);
      const rotatedBlob = await prepareImageBlobForUpload(sourceBlob, rotation);
      const contentType = getRotatedImageContentType(rotatedBlob);

      const { uploadUrl } = await persistApi.requestReplaceUploadUrl(documentId, contentType);
      const upload = persistApi.uploadToS3 ?? ocrApi.uploadToS3;
      await upload(uploadUrl, rotatedBlob, contentType);
      const { viewUrl } = await persistApi.confirmReplace(documentId);

      const nextUrl = viewUrl ?? displayUrl;
      setDisplayUrl(nextUrl);
      setRotation(0);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      onRotated?.(nextUrl);
      toast.success('Imagen rotada guardada');
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo guardar la rotación');
    } finally {
      setSaving(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetAtDrag.current = { ...offset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: offsetAtDrag.current.x + (e.clientX - dragStart.current.x),
      y: offsetAtDrag.current.y + (e.clientY - dragStart.current.y),
    });
  };

  const handleMouseUp = () => setDragging(false);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <FileText className="h-4 w-4" />
          {isPdf ? 'Documento PDF' : 'Imagen del documento'}
        </div>

        {!isPdf && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={scale <= MIN_SCALE || saving}
              className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Reducir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-xs text-white/60">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={scale >= MAX_SCALE || saving}
              className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => rotateBy(-90)}
              disabled={saving}
              className="ml-1 rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Rotar izquierda"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => rotateBy(90)}
              disabled={saving}
              className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Rotar derecha"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            {documentId && rotation !== 0 && (
              <button
                onClick={() => void handleSaveRotation()}
                disabled={saving}
                className="ml-2 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? 'Guardando…' : 'Guardar rotación'}
              </button>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          disabled={saving}
          className="rounded p-1 text-white/70 transition-colors hover:text-white disabled:opacity-30"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-4 pb-4"
        onMouseDown={isPdf ? undefined : handleMouseDown}
        onMouseMove={isPdf ? undefined : handleMouseMove}
        onMouseUp={isPdf ? undefined : handleMouseUp}
        onMouseLeave={isPdf ? undefined : handleMouseUp}
        style={{ cursor: isPdf ? 'default' : dragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }}
      >
        {isPdf ? (
          <iframe
            src={displayUrl}
            className="h-full w-full rounded-lg border border-white/10"
            title="Vista previa del documento"
          />
        ) : (
          <div className="flex h-full w-full select-none items-center justify-center">
            <img
              src={displayUrl}
              alt="Documento original"
              className="max-h-full max-w-full rounded-lg object-contain"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: dragging ? 'none' : 'transform 0.15s ease',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
