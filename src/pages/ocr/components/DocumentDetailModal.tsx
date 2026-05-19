/**
 * Modal de edición OCR para remitos.
 * Muestra el archivo original y solo los campos visibles en el dashboard.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Maximize2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getDocumentViewUrl } from '@/api/ocr';
import { useAppDispatch, useAppSelector } from '@/store';
import { updateDocumentFields } from '@/store/ocr/documentsSlice';
import { FilePreviewModal } from './FilePreviewModal';

type PresenceStatus = 'si' | 'duda' | 'no';

const PRIMARY_FIELD_KEYS = new Set([
  'fecha',
  'numero',
  'ptoVenta',
  'nroRemito',
  'firmaEstado',
  'firmado',
  'aclaracionEstado',
  'dniEstado',
]);

const FIELD_LABELS: Record<string, string> = {
  cliente: 'Cliente',
  cuitCliente: 'CUIT cliente',
  domicilioCliente: 'Domicilio cliente',
  lugarEntrega: 'Lugar de entrega',
  toneladas: 'Toneladas',
  producto: 'Producto',
  nroMercaderia: 'Nro. mercaderia',
  chofer: 'Chofer',
  camion: 'Camion',
  batea: 'Batea',
  cuitTransportista: 'CUIT transportista',
  domicilioTransportista: 'Domicilio transportista',
  destinatario: 'Destinatario',
  observaciones: 'Observaciones',
  productos: 'Items / productos',
};

interface EditForm {
  fecha: string;
  numeroRemito: string;
  firmaEstado: PresenceStatus;
  aclaracionEstado: PresenceStatus;
  dniEstado: PresenceStatus;
}

interface Props {
  documentId: string;
  onClose:    () => void;
  submitting: boolean;
}

function normalizePresence(value: unknown): PresenceStatus {
  const raw = String(value ?? '').trim().toLowerCase();
  if (['si', 'sí', 'true', 'presente', 'detectado', 'ok'].includes(raw)) return 'si';
  if (['duda', 'dudoso', 'incierto', 'revisar', 'probable'].includes(raw)) return 'duda';
  return 'no';
}

function buildInitialForm(data: Record<string, string> | null | undefined): EditForm {
  const ptoVenta = data?.['ptoVenta']?.trim() ?? '';
  const nroRemito = data?.['nroRemito']?.trim() ?? data?.['numero']?.trim() ?? '';
  const numeroRemito = ptoVenta && nroRemito ? `${ptoVenta}-${nroRemito}` : nroRemito;

  return {
    fecha: data?.['fecha'] ?? '',
    numeroRemito,
    firmaEstado: normalizePresence(data?.['firmaEstado'] ?? data?.['firmado']),
    aclaracionEstado: normalizePresence(data?.['aclaracionEstado']),
    dniEstado: normalizePresence(data?.['dniEstado']),
  };
}

function toUpdatePayload(form: EditForm): Record<string, string> {
  const cleanNumber = form.numeroRemito.trim();
  const match = /^(\d{4,5})\s*[-–]\s*(\d{5,8})$/.exec(cleanNumber);

  return {
    fecha: form.fecha.trim(),
    ...(match
      ? { ptoVenta: match[1], nroRemito: match[2] }
      : { nroRemito: cleanNumber }),
    firmaEstado: form.firmaEstado,
    firmado: form.firmaEstado === 'si' ? 'si' : 'no',
    aclaracionEstado: form.aclaracionEstado,
    dniEstado: form.dniEstado,
  };
}

function buildExtraFields(data: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (!PRIMARY_FIELD_KEYS.has(key)) out[key] = value ?? '';
  }
  return out;
}

export function DocumentDetailModal({
  documentId,
  onClose,
  submitting,
}: Props) {
  const dispatch = useAppDispatch();
  const current = useAppSelector((s) => s.ocrDocuments.current);
  const doc = current?.id === documentId ? current : null;

  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(buildInitialForm(null));
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    if (current?.id === documentId && current.viewUrl) {
      setViewUrl(current.viewUrl);
      return;
    }
    setLoadingUrl(true);
    getDocumentViewUrl(documentId)
      .then(({ viewUrl: url }) => setViewUrl(url))
      .catch(() => setViewUrl(null))
      .finally(() => setLoadingUrl(false));
  }, [documentId, current?.id, current?.viewUrl]);

  useEffect(() => {
    if (!doc) return;
    setForm(buildInitialForm(doc.extractedData));
    setExtraFields(buildExtraFields(doc.extractedData));
  }, [doc]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewOpen) return;
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, previewOpen]);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    const result = await dispatch(updateDocumentFields({
      id: doc.id,
      fields: { ...extraFields, ...toUpdatePayload(form) },
    }));
    setSaving(false);

    if (updateDocumentFields.fulfilled.match(result)) {
      toast.success('Campos actualizados');
      onClose();
    } else {
      toast.error(String(result.error?.message ?? 'Error al guardar'));
    }
  };

  const updateField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-auto w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              {doc ? `Editar remito ${doc.id.slice(0, 8)}...` : 'Cargando...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-lg leading-none text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            x
          </button>
        </div>

        {!doc ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Cargando detalle...</div>
        ) : (
          <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-4">
            {loadingUrl ? (
              <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-muted/40">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : viewUrl ? (
              doc.s3Key.endsWith('.pdf') ? (
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
                    src={viewUrl}
                    alt="Documento original"
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Fecha</span>
                <input
                  type="text"
                  value={form.fecha}
                  onChange={(e) => updateField('fecha', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Número de remito</span>
                <input
                  type="text"
                  value={form.numeroRemito}
                  onChange={(e) => updateField('numeroRemito', e.target.value)}
                  placeholder="00008-00057783"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <PresenceSelect
                label="Firma"
                value={form.firmaEstado}
                onChange={(value) => updateField('firmaEstado', value)}
              />
              <PresenceSelect
                label="Aclaración"
                value={form.aclaracionEstado}
                onChange={(value) => updateField('aclaracionEstado', value)}
              />
              <PresenceSelect
                label="DNI"
                value={form.dniEstado}
                onChange={(value) => updateField('dniEstado', value)}
              />
            </div>

            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowExtraFields((value) => !value)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                <span>Ver otros detalles extraidos</span>
                {showExtraFields
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {showExtraFields && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(extraFields).length === 0 ? (
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      No hay otros detalles extraidos para este remito.
                    </p>
                  ) : (
                    Object.entries(extraFields).map(([key, value]) => (
                      <label key={key} className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {FIELD_LABELS[key] ?? key}
                        </span>
                        {value.length > 80 || value.includes('\n') ? (
                          <textarea
                            value={value}
                            onChange={(e) =>
                              setExtraFields((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            rows={3}
                            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              setExtraFields((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        )}
                        <span className="block font-mono text-[11px] text-muted-foreground">{key}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving || submitting}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!doc || saving || submitting}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {previewOpen && viewUrl && (
        <FilePreviewModal
          url={viewUrl}
          isPdf={doc?.s3Key.endsWith('.pdf') ?? false}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function PresenceSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PresenceStatus;
  onChange: (value: PresenceStatus) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PresenceStatus)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="si">Detectado</option>
        <option value="duda">Duda</option>
        <option value="no">No encontró</option>
      </select>
    </label>
  );
}
