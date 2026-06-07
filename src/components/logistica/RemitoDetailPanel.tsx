import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Maximize2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { logisticaApi } from '@/api/logistica';
import type { RemitoDetalle } from '@/types/logistica.types';
import { FilePreviewModal } from '@/pages/ocr/components/FilePreviewModal';

interface Props {
  remitoId: string;
  onClose:   () => void;
  onDeleted?: (id: string) => void;
  index:    number;
  total:    number;
  onPrev:   () => void;
  onNext:   () => void;
  hasPrev:  boolean;
  hasNext:  boolean;
}

const FIELD_LABELS: { key: keyof RemitoDetalle; label: string }[] = [
  { key: 'nroRemito',     label: 'N° remito' },
  { key: 'fecha',         label: 'Fecha' },
  { key: 'cliente',       label: 'Cliente' },
  { key: 'producto',      label: 'Producto' },
  { key: 'toneladas',     label: 'Toneladas' },
  { key: 'camion',        label: 'Camión' },
  { key: 'chofer',        label: 'Chofer' },
  { key: 'lugarEntrega',  label: 'Lugar de entrega' },
  { key: 'observaciones', label: 'Observaciones' },
];

export function RemitoDetailPanel({
  remitoId,
  onClose,
  onDeleted,
  index,
  total,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  const [remito, setRemito]             = useState<RemitoDetalle | null>(null);
  const [loading, setLoading]           = useState(true);
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRemito(null);
    logisticaApi.getRemito(remitoId)
      .then((r) => { if (!cancelled) setRemito(r); })
      .catch(() => { if (!cancelled) setRemito(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [remitoId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [remitoId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewOpen) return;
        if (confirmDelete) { setConfirmDelete(false); return; }
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, previewOpen, confirmDelete]);

  async function handleDelete() {
    if (!remito) return;
    setDeleting(true);
    try {
      await logisticaApi.deleteRemito(remito.id);
      toast.success('Remito eliminado');
      onDeleted?.(remito.id);
      onClose();
    } catch {
      toast.error('No se pudo eliminar el remito');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      {/* Backdrop — solo en mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
      />

      {/* Panel — modal en mobile, sidebar en desktop */}
      <div className="fixed z-50 flex flex-col inset-x-3 top-[5%] bottom-[5%] rounded-lg border border-border shadow-xl md:inset-y-0 md:right-0 md:left-auto md:w-[480px] md:rounded-none md:border-0 md:border-l md:shadow-2xl bg-card">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground truncate">
              {loading
                ? 'Cargando...'
                : remito
                  ? `Remito ${remito.nroRemito ?? 'sin número'}`
                  : 'Remito'}
            </h2>
            {total > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">{index + 1} / {total}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              title="Anterior (↑)"
              className="rounded p-1 hover:bg-accent disabled:opacity-30 text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              title="Siguiente (↓)"
              className="rounded p-1 hover:bg-accent disabled:opacity-30 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="ml-1 rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !remito ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No se pudo cargar el remito.</p>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Preview imagen / PDF */}
            {remito.viewUrl ? (
              remito.isPdf ? (
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="group flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 transition-colors hover:bg-muted/60"
                >
                  <FileText className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                  <span className="flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                    <Maximize2 className="h-3.5 w-3.5" /> Ver PDF
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="group relative w-full overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-90"
                >
                  <img
                    src={remito.viewUrl}
                    alt="Imagen del remito"
                    className="w-full object-contain max-h-[420px]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="rounded-full bg-black/60 p-2">
                      <Maximize2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </button>
              )
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-muted/40">
                <p className="text-xs text-muted-foreground">Vista previa no disponible</p>
              </div>
            )}

            {/* Campos */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELD_LABELS.map(({ key, label }) => {
                const value = remito[key];
                if (!value) return null;
                return (
                  <div key={key} className="space-y-0.5">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <p className="text-sm text-foreground">{String(value)}</p>
                  </div>
                );
              })}
            </div>

            {/* Subido por */}
            <div className="border-t border-border pt-3">
              <span className="text-xs font-medium text-muted-foreground">Subido por</span>
              <p className="text-sm text-foreground">{remito.uploadedByName}</p>
              <p className="text-xs text-muted-foreground">{remito.uploadedByEmail}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-destructive">¿Eliminar remito y su imagen?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sí, eliminar'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={!remito || loading}
              title="Eliminar remito"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            Cerrar
          </button>
        </div>
      </div>

      {previewOpen && remito?.viewUrl && (
        <FilePreviewModal
          url={remito.viewUrl}
          isPdf={remito.isPdf}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
