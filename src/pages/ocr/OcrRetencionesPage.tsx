/**
 * OcrRetencionesPage — Panel ADMINISTRATIVO para certificados de retención
 *
 * Extrae automáticamente:
 *  - CUIT del Agente de Retención (emisor del certificado)
 *  - Tipo de impuesto: GANANCIAS o IIBB
 *  - Provincia / jurisdicción IIBB si figura en el comprobante
 *  - Monto de la retención
 *
 * Flujo:
 *  1. Upload de certificado SI.CO.RE. (PDF o imagen)
 *  2. OCR asíncrono → polling hasta que termina
 *  3. Listado de retenciones propias con estado
 *  4. Corrección manual de campos incorrectamente extraídos
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Upload, FileText, Edit2, RefreshCw, AlertTriangle,
  ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import * as ocrApi from '@/api/ocr';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchMyRetenciones,
  updateDocumentFields,
  clearCurrent,
  fetchDocument,
  deleteDocument,
} from '@/store/ocr/documentsSlice';
import type { FilterDocumentsParams, OcrDocument } from '@/types/ocr.types';
import { DocumentStatus, DocumentType } from '@/types/ocr.types';
import { StatusBadge } from './components/StatusBadge';

// ── Tipos locales ──────────────────────────────────────────────────────────────

type UploadStep = 'idle' | 'uploading' | 'polling' | 'done' | 'error';

const EDITABLE_STATUSES = [DocumentStatus.CON_ERRORES, DocumentStatus.VALIDO, DocumentStatus.REVISION_PENDIENTE];
const POLL_INTERVAL_MS  = 2500;
const POLL_MAX_RETRIES  = 24;

/** Campos extraídos por OCR para retenciones */
const DEFAULT_RETENCION_FIELDS: Record<string, string> = {
  cuitEmisor:   '',
  tipoImpuesto: '',
  provincia:    '',
  monto:        '',
};

const FIELD_LABELS: Record<string, string> = {
  cuitEmisor:   'CUIT del Agente de Retención',
  tipoImpuesto: 'Tipo de impuesto (GANANCIAS / IIBB)',
  provincia:    'Provincia / jurisdicción IIBB',
  monto:        'Monto de la retención',
};

// ── Componente principal ──────────────────────────────────────────────────────

export function OcrRetencionesPage() {
  const dispatch = useAppDispatch();
  const { myRetenciones, loading, submitting, error, current } = useAppSelector((s) => s.ocrDocuments);

  const [uploadStep, setUploadStep]   = useState<UploadStep>('idle');
  const [uploadPct, setUploadPct]     = useState(0);
  const [pollStatus, setPollStatus]   = useState<DocumentStatus | null>(null);
  const [detailDoc, setDetailDoc]     = useState<OcrDocument | null>(null);
  const [filters, setFilters]         = useState<FilterDocumentsParams>({ page: 1, limit: 10 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(fetchMyRetenciones(filters));
  }, [dispatch, filters]);

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
    const allowed     = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(contentType)) {
      toast.error('Formato no permitido. Subí una imagen (JPG, PNG, WEBP) o un PDF.');
      return;
    }

    setUploadStep('uploading');
    setUploadPct(0);

    try {
      const { uploadUrl, documentId } = await ocrApi.requestUploadUrl(DocumentType.RETENCION, contentType);

      await ocrApi.uploadToS3(uploadUrl, file, contentType, setUploadPct);
      await ocrApi.confirmUpload(documentId);

      setUploadStep('polling');
      setPollStatus(DocumentStatus.PROCESANDO);
      await pollUntilDone(documentId);

    } catch (err) {
      const msg = (err as Error).message;
      const isStorage = msg.includes('S3') || msg.includes('almacenamiento') || msg.includes('AWS');
      toast.error(isStorage
        ? 'Servicio de almacenamiento no disponible. Contactar al administrador.'
        : `Error al subir: ${msg}`);
      setUploadStep('error');
    }
  }, []);

  const pollUntilDone = async (docId: string) => {
    for (let i = 0; i < POLL_MAX_RETRIES; i++) {
      await delay(POLL_INTERVAL_MS);
      try {
        const { status } = await ocrApi.getDocumentStatus(docId);
        setPollStatus(status);
        if (status !== DocumentStatus.PROCESANDO && status !== DocumentStatus.PENDIENTE) {
          setUploadStep('done');
          dispatch(fetchMyRetenciones(filters));
          if (status === DocumentStatus.VALIDO) {
            toast.success('Retención procesada correctamente');
          } else if (status === DocumentStatus.CON_ERRORES) {
            toast.warning('La retención tiene errores — podés corregir los campos en la tabla');
          }
          return;
        }
      } catch { /* continuar */ }
    }
    setUploadStep('done');
    toast.warning('Procesamiento tardó más de lo esperado. Revisá el estado en la tabla.');
  };

  const resetUpload = () => {
    setUploadStep('idle');
    setUploadPct(0);
    setPollStatus(null);
  };

  // ── Detalle / Corrección / Borrado ────────────────────────────────────────

  const openDetail = async (doc: OcrDocument) => {
    setDetailDoc(doc);
    dispatch(fetchDocument(doc.id));
  };

  const closeDetail = () => {
    setDetailDoc(null);
    dispatch(clearCurrent());
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta retención? Esta acción no se puede deshacer.')) return;
    const result = await dispatch(deleteDocument(id));
    if (deleteDocument.fulfilled.match(result)) {
      toast.success('Retención eliminada');
      dispatch(fetchMyRetenciones(filters));
    } else {
      toast.error('No se pudo eliminar la retención');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const docs  = myRetenciones?.items ?? [];
  const total = myRetenciones?.total ?? 0;
  const page  = myRetenciones?.page  ?? filters.page ?? 1;
  const pages = myRetenciones?.pages ?? 1;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Mis Retenciones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cargá certificados de retención (SI.CO.RE.) — el sistema extrae el CUIT, impuesto, provincia si figura y monto
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Zona de upload ─────────────────────────────────────────────── */}
      {uploadStep === 'idle' && (
        <div className="space-y-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">Subir certificado de retención</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF o imagen del formulario SI.CO.RE. · El sistema extrae CUIT, impuesto, provincia si figura y monto
            </p>
            <button className="mt-4 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Seleccionar archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

        </div>
      )}

      {uploadStep === 'uploading' && (
        <div className="border border-border rounded-xl p-6 text-center space-y-4">
          <Upload className="h-10 w-10 mx-auto text-primary animate-bounce" />
          <p className="text-sm font-medium text-foreground">Subiendo certificado…</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{uploadPct}%</p>
        </div>
      )}

      {uploadStep === 'polling' && (
        <div className="border border-border rounded-xl p-6 text-center space-y-3">
          <RefreshCw className="h-10 w-10 mx-auto text-blue-500 animate-spin" />
          <p className="text-sm font-medium text-foreground">Procesando OCR…</p>
          <p className="text-xs text-muted-foreground">Extrayendo CUIT, impuesto, provincia y monto del certificado.</p>
          {pollStatus && <StatusBadge status={pollStatus} />}
        </div>
      )}

      {(uploadStep === 'done' || uploadStep === 'error') && (
        <div className="border border-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {pollStatus && <StatusBadge status={pollStatus} />}
            {uploadStep === 'error' && <span className="text-red-600">Error al procesar</span>}
          </div>
          <button onClick={resetUpload} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent">
            Subir otra
          </button>
        </div>
      )}

      {/* ── Lista de retenciones ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Retenciones cargadas</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{total} retenciones</p>
            <button
              onClick={() => dispatch(fetchMyRetenciones(filters))}
              disabled={loading}
              className="p-1 rounded hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado OCR</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">CUIT Emisor</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Impuesto</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Provincia</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Monto</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Cargando…
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Todavía no subiste ningún certificado de retención
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">{doc.id.slice(0, 8)}…</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={doc.status} />
                        {doc.observaciones && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {doc.observaciones}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">
                      {doc.extractedData?.['cuitEmisor'] || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {doc.extractedData?.['tipoImpuesto'] || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {doc.extractedData?.['provincia'] || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {doc.extractedData?.['monto'] ? `$\u00a0${doc.extractedData['monto']}` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openDetail(doc)}
                          className="px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                        >
                          {EDITABLE_STATUSES.includes(doc.status)
                            ? <><Edit2 className="h-3 w-3" /> Corregir</>
                            : 'Ver detalle'}
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          title="Eliminar"
                          className="p-1 rounded text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Página {page} de {pages}</p>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="p-1.5 rounded border border-border hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="p-1.5 rounded border border-border hover:bg-accent disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Campos extraídos</p>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          El sistema extrae el CUIT del emisor, tipo de impuesto, provincia si figura y monto del certificado.
          Podés corregir cualquier campo mal extraído antes de que el ADMIN lo apruebe.
        </p>
      </div>

      {/* Modal de corrección */}
      {detailDoc && (
        <CorrectFieldsModal
          doc={current?.id === detailDoc.id ? current : detailDoc}
          onClose={closeDetail}
          onSave={async (fields) => {
            const result = await dispatch(updateDocumentFields({ id: detailDoc.id, fields }));
            if (updateDocumentFields.fulfilled.match(result)) {
              toast.success('Campos guardados');
              closeDetail();
              dispatch(fetchMyRetenciones(filters));
            } else {
              toast.error(String(result.error?.message ?? 'Error al guardar'));
            }
          }}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// ── Modal de corrección de campos ─────────────────────────────────────────────

function CorrectFieldsModal({
  doc, onClose, onSave, submitting,
}: {
  doc:        OcrDocument;
  onClose:    () => void;
  onSave:     (fields: Record<string, string>) => void;
  submitting: boolean;
}) {
  const canEdit = EDITABLE_STATUSES.includes(doc.status);
  const [fields, setFields] = useState<Record<string, string>>(doc.extractedData ?? {});

  const allFields = { ...DEFAULT_RETENCION_FIELDS, ...fields };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-xl shadow-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              Retención — {doc.id.slice(0, 8)}…
            </h2>
            <StatusBadge status={doc.status} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Preview */}
          {doc.viewUrl ? (
            doc.s3Key.endsWith('.pdf') ? (
              <div className="bg-muted/40 rounded-lg h-32 flex items-center justify-center border border-border">
                <a href={doc.viewUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  Abrir PDF
                </a>
              </div>
            ) : (
              <img src={doc.viewUrl} alt="Retención" className="w-full rounded-lg border border-border object-contain max-h-48" />
            )
          ) : (
            <div className="bg-muted/40 rounded-lg h-32 flex items-center justify-center border border-border">
              <p className="text-xs text-muted-foreground">Vista previa no disponible</p>
            </div>
          )}

          {/* Errores OCR */}
          {doc.validationErrors && doc.validationErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Campos con errores OCR</p>
              </div>
              {doc.validationErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">• {e}</p>
              ))}
            </div>
          )}

          {/* Campos editables */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Campos extraídos por OCR
              {!canEdit && ' (solo lectura)'}
            </p>
            {Object.entries(allFields).map(([key, value]) => {
              const hasError = doc.validationErrors?.some((e) =>
                e.toLowerCase().includes(key.toLowerCase()),
              );
              const label = FIELD_LABELS[key] ?? key;
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={fields[key] ?? value}
                    disabled={!canEdit}
                    onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                    className={[
                      'w-full rounded-md border px-3 py-2 text-sm',
                      hasError
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-700'
                        : 'border-border bg-background',
                      !canEdit ? 'opacity-60 cursor-not-allowed' : '',
                    ].join(' ')}
                  />
                  {key === 'tipoImpuesto' && canEdit && (
                    <p className="text-xs text-muted-foreground mt-1">Valores válidos: GANANCIAS o IIBB</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent">
            Cerrar
          </button>
          {canEdit && (
            <button
              onClick={() => onSave(fields)}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              <Edit2 className="h-3.5 w-3.5" />
              {submitting ? 'Guardando…' : 'Guardar correcciones'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
