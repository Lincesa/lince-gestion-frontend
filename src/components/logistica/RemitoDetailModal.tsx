import { useEffect, useState } from 'react';
import { FileText, Loader2, Maximize2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { logisticaApi } from '@/api/logistica';
import type { RemitoDetalle } from '@/types/logistica.types';
import { FilePreviewModal } from '@/pages/ocr/components/FilePreviewModal';

interface Props {
  remitoId:   string;
  onClose:    () => void;
  onDeleted?: (id: string) => void;
}

const FIELD_LABELS: { key: keyof RemitoDetalle; label: string }[] = [
  { key: 'nroRemito',    label: 'N° remito' },
  { key: 'fecha',        label: 'Fecha' },
  { key: 'cliente',      label: 'Cliente' },
  { key: 'producto',     label: 'Producto' },
  { key: 'toneladas',    label: 'Toneladas' },
  { key: 'camion',       label: 'Camión' },
  { key: 'chofer',       label: 'Chofer' },
  { key: 'lugarEntrega', label: 'Lugar de entrega' },
  { key: 'observaciones', label: 'Observaciones' },
];

export function RemitoDetailModal({ remitoId, onClose, onDeleted }: Props) {
  const [remito, setRemito]               = useState<RemitoDetalle | null>(null);
  const [loading, setLoading]             = useState(true);
  const [previewOpen, setPreviewOpen]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  useEffect(() => {
    setLoading(true);
    logisticaApi.getRemito(remitoId)
      .then(setRemito)
      .catch(() => setRemito(null))
      .finally(() => setLoading(false));
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

  const handleDelete = async () => {
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-auto w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              {loading ? 'Cargando...' : remito ? `Remito ${remito.nroRemito ?? 'sin número'}` : 'Remito'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !remito ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-muted-foreground">No se pudo cargar el remito.</p>
            </div>
          ) : (
            <>
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

              {/* Campos del remito */}
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
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
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
    </div>
  );
}
