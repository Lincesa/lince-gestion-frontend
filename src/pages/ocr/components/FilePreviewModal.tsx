/**
 * FilePreviewModal — visor de archivos a pantalla completa.
 * Soporta imágenes (con zoom + arrastre) y PDFs (via <iframe>).
 * Se abre sobre el DocumentDetailModal (z-60).
 */
import { useEffect, useRef, useState } from 'react';
import { X, FileText, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface Props {
  url:      string;
  isPdf:    boolean;
  onClose:  () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

export function FilePreviewModal({ url, isPdf, onClose }: Props) {
  const [scale, setScale]       = useState(1);
  const [offset, setOffset]     = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef  = useRef<HTMLDivElement>(null);
  const dragStart     = useRef({ x: 0, y: 0 });
  const offsetAtDrag  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Rueda del mouse: listener no-pasivo para poder llamar preventDefault
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

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <FileText className="h-4 w-4" />
          {isPdf ? 'Documento PDF' : 'Imagen del documento'}
        </div>

        {!isPdf && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={scale <= MIN_SCALE}
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
              disabled={scale >= MAX_SCALE}
              className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={reset}
              disabled={scale === 1}
              className="ml-1 rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Restablecer zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="rounded p-1 text-white/70 transition-colors hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Contenido */}
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
            src={url}
            className="h-full w-full rounded-lg border border-white/10"
            title="Vista previa del documento"
          />
        ) : (
          <div className="flex h-full w-full select-none items-center justify-center">
            <img
              src={url}
              alt="Documento original"
              className="max-h-full max-w-full rounded-lg object-contain"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
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
    </div>
  );
}
