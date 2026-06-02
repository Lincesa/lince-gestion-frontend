/**
 * OcrDashboardPage — Vista ADMIN / SUPERADMIN para remitos.
 * Facturas y retenciones quedan ocultas temporalmente del front.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadDocumentFile, getOcrStats } from '@/api/ocr';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  clearCurrent,
  deleteDocument,
  fetchDocument,
  fetchDocuments,
} from '@/store/ocr/documentsSlice';
import type { FilterDocumentsParams, OcrDocument, OcrStats } from '@/types/ocr.types';
import { DocumentStatus, DocumentType } from '@/types/ocr.types';
import { DocumentDetailModal } from './components/DocumentDetailModal';
import { UPLOADER_CHIPS } from '@/constants/uploaderChips';

type PresenceStatus = 'si' | 'duda' | 'no';

const PRESENCE_CONFIG: Record<PresenceStatus, { label: string; className: string; icon: ReactNode }> = {
  si: {
    label: 'Detectado',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  duda: {
    label: 'Duda',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  no: {
    label: 'No encontró',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

function normalizePresence(value: unknown): PresenceStatus {
  const raw = String(value ?? '').trim().toLowerCase();
  if (['si', 'sí', 'true', 'presente', 'detectado', 'ok'].includes(raw)) return 'si';
  if (['duda', 'dudoso', 'incierto', 'revisar', 'probable'].includes(raw)) return 'duda';
  return 'no';
}

function getPresence(doc: OcrDocument, field: 'firma' | 'aclaracion' | 'dni'): PresenceStatus {
  const data = doc.extractedData ?? {};
  if (field === 'firma') return normalizePresence(data['firmaEstado'] ?? data['firmado']);
  if (field === 'aclaracion') return normalizePresence(data['aclaracionEstado']);
  return normalizePresence(data['dniEstado']);
}

function formatRemitoNumber(doc: OcrDocument): string {
  const data = doc.extractedData ?? {};
  const ptoVenta = data['ptoVenta']?.trim();
  const nroRemito = data['nroRemito']?.trim();
  if (ptoVenta && nroRemito) return `${ptoVenta}-${nroRemito}`;
  return nroRemito || data['numero'] || '—';
}

function formatDocumentDate(doc: OcrDocument): string {
  return doc.extractedData?.['fecha'] || '—';
}

function formatUploadDate(doc: OcrDocument): string {
  return new Date(doc.createdAt).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatEditedAt(doc: OcrDocument): string {
  if (!doc.correctedAt) return 'Sin editar';
  return `Editado ${new Date(doc.correctedAt).toLocaleString('es-AR')}`;
}

function PresenceBadge({ status }: { status: PresenceStatus }) {
  const config = PRESENCE_CONFIG[status];
  return (
    <span className={`inline-flex min-w-[112px] items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

export function OcrDashboardPage() {
  const dispatch = useAppDispatch();
  const { all, loading, submitting, error } = useAppSelector((s) => s.ocrDocuments);

  const [filters, setFilters] = useState<FilterDocumentsParams>({
    page: 1,
    limit: 20,
    type: DocumentType.REMITO,
  });
  const [nroRemitoInput, setNroRemitoInput] = useState('');
  const [detailDoc, setDetailDoc] = useState<OcrDocument | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [stats, setStats] = useState<OcrStats | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const filtersWithType = { ...filters, type: DocumentType.REMITO };
    dispatch(fetchDocuments(filtersWithType));
    getOcrStats(filtersWithType).then(setStats).catch(() => {});
  }, [dispatch, filters]);

  const handleNroRemitoChange = (value: string) => {
    setNroRemitoInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, nroRemito: value || undefined, page: 1 }));
    }, 400);
  };

  const toggleUploaderChip = (email: string) => {
    setFilters((f) => ({
      ...f,
      uploadedByEmail: f.uploadedByEmail === email ? undefined : email,
      page: 1,
    }));
  };

  const handleDelete = async (id: string) => {
    const result = await dispatch(deleteDocument(id));
    if (deleteDocument.fulfilled.match(result)) {
      toast.success('Documento eliminado');
      setDeleteId(null);
    } else {
      toast.error(String(result.error?.message ?? 'Error al eliminar'));
    }
  };

  const openDetail = async (doc: OcrDocument) => {
    await dispatch(fetchDocument(doc.id));
    setDetailDoc(doc);
  };

  const handleDownload = async (doc: OcrDocument) => {
    setDownloadingId(doc.id);
    try {
      const blob = await downloadDocumentFile(doc.id);
      const ext = doc.s3Key.match(/\.([^.]+)$/)?.[1] ?? 'jpg';
      const number = formatRemitoNumber(doc).replace(/[^a-zA-Z0-9._-]+/g, '_');
      const filename = number === '—' ? `remito-${doc.id.slice(0, 8)}.${ext}` : `remito-${number}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Foto del remito descargada');
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo descargar la foto');
    } finally {
      setDownloadingId(null);
    }
  };

  const docs = all?.items ?? [];
  const total = stats?.total ?? all?.total ?? 0;
  const page = all?.page ?? filters.page ?? 1;
  const pages = all?.pages ?? 1;
  const edited = stats?.editados ?? 0;
  const firmaCounts     = stats?.firma      ?? { si: 0, duda: 0, no: 0 };
  const aclaracionCounts = stats?.aclaracion ?? { si: 0, duda: 0, no: 0 };
  const dniCounts       = stats?.dni         ?? { si: 0, duda: 0, no: 0 };
  const statsTotal = stats ? stats.firma.si + stats.firma.duda + stats.firma.no : 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Dashboard OCR — Remitos</h1>
        </div>
        <button
          onClick={() => dispatch(fetchDocuments({ ...filters, type: DocumentType.REMITO }))}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
        {/* Total + Editados */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{total}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Editados</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{edited}</p>
          </div>
        </div>

        {/* Detección por campo */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Detección total</p>
          <div className="space-y-2.5">
            {([
              ['Firma', firmaCounts],
              ['Aclaración', aclaracionCounts],
              ['DNI', dniCounts],
            ] as const).map(([label, counts]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-foreground">{label}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3.5 w-3.5" />{counts.si}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5" />{counts.duda}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-red-500 dark:text-red-400">
                    <XCircle className="h-3.5 w-3.5" />{counts.no}
                  </span>
                </div>
                {statsTotal > 0 && (
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="bg-green-500" style={{ width: `${(counts.si / statsTotal) * 100}%` }} />
                    <div className="bg-yellow-400" style={{ width: `${(counts.duda / statsTotal) * 100}%` }} />
                    <div className="bg-red-400" style={{ width: `${(counts.no / statsTotal) * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chips de uploader ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Origen:</span>
        {UPLOADER_CHIPS.map((chip) => {
          const active = filters.uploadedByEmail === chip.email;
          return (
            <button
              key={chip.email}
              onClick={() => toggleUploaderChip(chip.email)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Búsqueda por número de remito */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Nro. remito…"
            value={nroRemitoInput}
            onChange={(e) => handleNroRemitoChange(e.target.value)}
            className="pl-8 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-40"
          />
        </div>
        {/* Estado */}
        <select
          value={filters.status ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value as DocumentStatus) || undefined, page: 1 }))}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los estados</option>
          {Object.values(DocumentStatus).map((status) => (
            <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
          ))}
        </select>
        {/* Rango de fechas de upload */}
        <input
          type="date"
          title="Desde"
          value={filters.dateFrom ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="date"
          title="Hasta"
          value={filters.dateTo ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Fecha subida</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Fecha remito</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Número de remito</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Firma</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Aclaración</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">DNI</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Edición</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && docs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay remitos con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatUploadDate(doc)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDocumentDate(doc)}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground">{formatRemitoNumber(doc)}</td>
                    <td className="px-4 py-2.5 text-center"><PresenceBadge status={getPresence(doc, 'firma')} /></td>
                    <td className="px-4 py-2.5 text-center"><PresenceBadge status={getPresence(doc, 'aclaracion')} /></td>
                    <td className="px-4 py-2.5 text-center"><PresenceBadge status={getPresence(doc, 'dni')} /></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatEditedAt(doc)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          title="Descargar foto del remito"
                          className="rounded p-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        >
                          {downloadingId === doc.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => openDetail(doc)}
                          className="rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => setDeleteId(doc.id)}
                          disabled={submitting}
                          title="Eliminar documento"
                          className="rounded p-1 text-xs text-muted-foreground hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-400"
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

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Página {page} de {pages} · {total} remitos
          </p>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="rounded border border-border p-1.5 hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="rounded border border-border p-1.5 hover:bg-accent disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {detailDoc && (
        <DocumentDetailModal
          documentId={detailDoc.id}
          onClose={() => { setDetailDoc(null); dispatch(clearCurrent()); }}
          submitting={submitting}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-foreground">¿Eliminar documento?</h3>
            <p className="mb-5 text-sm text-muted-foreground">
              Esta acción es irreversible. El documento y su archivo serán eliminados permanentemente.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                disabled={submitting}
                className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={submitting}
                className="rounded bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
