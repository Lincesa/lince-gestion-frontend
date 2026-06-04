import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearSelectedRemito, removeRemitoFromList } from '@/store/logistica/remitosSlice';
import { logisticaApi } from '@/api/logistica';

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE:          'Pendiente',
  PROCESANDO:         'Procesando',
  VALIDO:             'Válido',
  CON_ERRORES:        'Con errores',
  REVISION_PENDIENTE: 'Revisión pendiente',
  REVISADO:           'Revisado',
  APROBADO:           'Aprobado',
  RECHAZADO:          'Rechazado',
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-0.5">{value}</dd>
    </div>
  );
}

export function RemitoSidebar() {
  const dispatch        = useAppDispatch();
  const { selected, detailLoading } = useAppSelector((s) => s.remitosLogistica);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  if (!selected && !detailLoading) return null;

  const close = () => { setConfirmDelete(false); dispatch(clearSelectedRemito()); };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await logisticaApi.deleteRemito(selected.id);
      dispatch(removeRemitoFromList(selected.id));
      dispatch(clearSelectedRemito());
      toast.success('Remito eliminado');
    } catch {
      toast.error('No se pudo eliminar el remito');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/20"
        style={{ zIndex: 9998 }}
        onClick={close}
      />
      <aside
        className="fixed right-0 top-0 w-[420px] max-w-full bg-background border-l border-border shadow-xl flex flex-col overflow-hidden"
        style={{ zIndex: 9999, height: '100dvh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold text-base">
            {selected ? `Remito ${selected.nroRemito ?? selected.id.slice(0, 8)}` : 'Cargando...'}
          </h3>
          <button
            onClick={close}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {detailLoading && !selected && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {selected && (
          <div className="flex-1 overflow-y-auto">
            {/* Preview imagen */}
            {selected.viewUrl && (
              <div className="bg-muted/30 flex items-center justify-center min-h-[200px] max-h-[280px] overflow-hidden">
                <img
                  src={selected.viewUrl}
                  alt={`Remito ${selected.nroRemito ?? ''}`}
                  className="max-h-[280px] object-contain"
                  loading="lazy"
                />
              </div>
            )}

            <dl className="p-5 space-y-4">
              <Field label="N° Remito"     value={selected.nroRemito} />
              <Field label="Fecha"         value={selected.fecha} />
              <Field label="Cliente"       value={selected.cliente} />
              <Field label="Lugar entrega" value={selected.lugarEntrega} />
              <Field label="Producto"      value={selected.producto} />
              <Field label="Toneladas"     value={selected.toneladas} />
              <Field label="Camión"        value={selected.camion} />
              <Field label="Chofer"        value={selected.chofer} />
              {selected.observaciones && (
                <Field label="Observaciones" value={selected.observaciones} />
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Estado</dt>
                <dd className="text-sm font-medium mt-0.5">
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Subido por</dt>
                <dd className="text-sm font-medium mt-0.5">{selected.uploadedByName}</dd>
                <dd className="text-xs text-muted-foreground">{selected.uploadedByEmail}</dd>
              </div>
              {selected.latitude !== null && selected.longitude !== null && (
                <div>
                  <dt className="text-xs text-muted-foreground">Coordenadas</dt>
                  <dd className="text-sm font-mono mt-0.5">
                    {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {selected && (
          <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
            <a
              href={logisticaApi.getFileUrl(selected.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar remito
            </a>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive flex-1">¿Eliminar remito y su imagen?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sí'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 w-full px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar remito
              </button>
            )}
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}
