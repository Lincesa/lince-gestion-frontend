/**
 * OcrRemitosPage — Terminal de campo (OPERADOR_CAMPO)
 *
 * Flujo completo:
 *  1. Captura con webcam (MediaDevices.getUserMedia) o selección de archivo
 *  2. Preview + confirmación antes de subir
 *  3. Upload: requestUploadUrl → PUT a S3 → confirmUpload → OCR asíncrono
 *  4. Polling de estado hasta que el OCR termine
 *  5. Cola offline: si falla la conexión, guarda en localStorage para reintentar
 *
 * Credenciales:
 *  - Sin S3 configurado → el backend devuelve error → se muestra "Servicio no disponible"
 *  - Sin engine OCR configurado (Document AI/Vision) → estado CON_ERRORES con mensaje claro
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Upload, Wifi, WifiOff, CheckCircle, Clock, AlertTriangle, X, RefreshCw, Trash2, FlaskConical, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import * as ocrApi from '@/api/ocr';
import { DocumentStatus, DocumentType } from '@/types/ocr.types';
import { StatusBadge } from './components/StatusBadge';
import { OcrTestModal } from './components/OcrTestModal';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchMyFacturas } from '@/store/ocr/documentsSlice';

// ── Tipos locales ─────────────────────────────────────────────────────────────

type UploadStep = 'idle' | 'capture' | 'preview' | 'uploading' | 'polling' | 'done' | 'error';
type RotationDegrees = 0 | 90 | 180 | 270;

interface QueueItem {
  id:         string;
  preview:    string;  // object URL local
  status:     'pending' | 'synced' | 'error';
  documentId?: string;
  createdAt:  string;
  errorMsg?:  string;
}

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_RETRIES = 24; // 24 × 2.5s = 1 minuto máximo
const DELETE_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

function canDeleteFromDb(item: QueueItem): boolean {
  if (!item.documentId || item.status !== 'synced') return false;
  return Date.now() - new Date(item.createdAt).getTime() < DELETE_WINDOW_MS;
}

function deleteWindowRemaining(item: QueueItem): string {
  const remaining = DELETE_WINDOW_MS - (Date.now() - new Date(item.createdAt).getTime());
  if (remaining <= 0) return '';
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function OcrRemitosPage() {
  const dispatch     = useAppDispatch();
  const { myFacturas } = useAppSelector((s) => s.ocrDocuments);

  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [step, setStep]               = useState<UploadStep>('idle');
  const [uploadPct, setUploadPct]     = useState(0);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [pollStatus, setPollStatus]   = useState<DocumentStatus | null>(null);
  const [pollErrors, setPollErrors]   = useState<string[] | null>(null);
  const [queue, setQueue]             = useState<QueueItem[]>(() => loadQueue());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState<RotationDegrees>(0);
  // ticker para re-render mientras haya items dentro de la ventana de 5 min
  const [, setTick] = useState(0);

  // ── Test OCR sin S3 ─────────────────────────────────────────────────────────
  const [testModalOpen,    setTestModalOpen]    = useState(false);
  const [testLoading,      setTestLoading]      = useState(false);
  const [testError,        setTestError]        = useState<string | null>(null);
  const [testFields,       setTestFields]       = useState<Record<string, string> | null>(null);

  const handleTestExtract = useCallback(async () => {
    if (!capturedBlob) return;
    setTestModalOpen(true);
    setTestLoading(true);
    setTestError(null);
    setTestFields(null);
    try {
      const preparedBlob = await prepareBlobForOcr(capturedBlob, rotationDegrees);
      const file   = preparedBlob instanceof File ? preparedBlob : new File([preparedBlob], 'remito.jpg', { type: getUploadContentType(preparedBlob) });
      const result = await ocrApi.testExtract(file, DocumentType.REMITO);
      setTestFields(result.fields);
    } catch (err) {
      setTestError((err as Error).message);
    } finally {
      setTestLoading(false);
    }
  }, [capturedBlob, rotationDegrees]);

  const videoRef       = useRef<HTMLVideoElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Conectividad
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Cargar historial de remitos propios
  useEffect(() => {
    dispatch(fetchMyFacturas({ limit: 5 }));
  }, [dispatch]);

  // Interval de 1s mientras haya items dentro de la ventana de eliminación
  useEffect(() => {
    const hasActive = queue.some(
      (item) =>
        item.documentId &&
        item.status === 'synced' &&
        Date.now() - new Date(item.createdAt).getTime() < DELETE_WINDOW_MS,
    );
    if (!hasActive) return;

    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [queue]);

  // ── Webcam ──────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStep('capture');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const msg = (err as Error).name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Habilitarlo en la configuración del navegador.'
        : `No se pudo acceder a la cámara: ${(err as Error).message}`;
      setCameraError(msg);
      setStep('idle');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      setCapturedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setRotationDegrees(0);
      setStep('preview');
    }, 'image/jpeg', 0.92);
  }, [stopCamera]);

  const cancelCapture = useCallback(() => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl(null);
    setRotationDegrees(0);
    setStep('idle');
  }, [stopCamera, previewUrl]);

  // ── Seleccionar archivo ─────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRotationDegrees(0);
    setStep('preview');
    e.target.value = '';
  };

  const rotatePreview = useCallback((degrees: 90 | -90) => {
    if (!capturedBlob) return;

    if (isPdfBlob(capturedBlob)) {
      toast.error('Solo se pueden rotar imágenes. Los PDF se deben corregir antes de subir.');
      return;
    }

    setRotationDegrees((current) => normalizeRotation(current + degrees));
  }, [capturedBlob]);

  // ── Upload pipeline ─────────────────────────────────────────────────────────

  const uploadDocument = useCallback(async () => {
    if (!capturedBlob) return;

    setStep('uploading');
    setUploadPct(0);

    let documentId: string | undefined;

    try {
      const uploadBlob = await prepareBlobForOcr(capturedBlob, rotationDegrees);
      const contentType = getUploadContentType(uploadBlob);

      // Paso 1: solicitar presigned URL
      const { uploadUrl, documentId: docId } = await ocrApi.requestUploadUrl(
        DocumentType.REMITO,
        contentType,
      );
      documentId = docId;

      // Paso 2: subir a S3 con progreso
      await ocrApi.uploadToS3(uploadUrl, uploadBlob, contentType, setUploadPct);

      // Paso 3: confirmar al backend → dispara OCR (o detecta duplicado)
      const confirmResult = await ocrApi.confirmUpload(documentId);

      if (confirmResult.isDuplicate) {
        const fecha = confirmResult.originalUploadedAt
          ? new Date(confirmResult.originalUploadedAt).toLocaleString('es-AR', {
              dateStyle: 'short', timeStyle: 'short',
            })
          : 'una subida anterior';
        toast.warning(`Este remito ya fue subido (${fecha}). No se duplicó.`);
        setStep('idle');
        setUploadPct(0);
        return;
      }

      // Agregar a cola local como "synced"
      const newItem: QueueItem = {
        id:         crypto.randomUUID(),
        preview:    previewUrl ?? 'Remito capturado',
        status:     'synced',
        documentId: confirmResult.documentId,
        createdAt:  new Date().toISOString(),
      };
      addToQueue(newItem);

      // Paso 4: polling hasta que el OCR termine
      setStep('polling');
      setPollStatus(DocumentStatus.PROCESANDO);
      await pollDocumentStatus(confirmResult.documentId);

    } catch (err) {
      const msg = (err as Error).message;

      // Si el error es de S3 (servicio no configurado), mostrarlo claramente
      const isStorageError = msg.includes('S3') || msg.includes('almacenamiento') || msg.includes('AWS');
      // Guard de volumen del backend (HTTP 429): no es un fallo reintenable.
      const isRateLimited = msg.includes('Límite de subidas');

      toast.error(
        isStorageError
          ? 'Servicio de almacenamiento no disponible. Contactar al administrador.'
          : isRateLimited
            ? 'Alcanzaste el límite de subidas. Esperá unos minutos o avisá al administrador.'
            : `Error al subir: ${msg}`,
      );

      // Encolar para reintento solo si fue un fallo transitorio (no límite ni S3).
      if (!isStorageError && !isRateLimited) {
        const offlineItem: QueueItem = {
          id:       crypto.randomUUID(),
          preview:  previewUrl ?? 'Remito pendiente',
          status:   'error',
          documentId,
          createdAt: new Date().toISOString(),
          errorMsg:  msg,
        };
        addToQueue(offlineItem);
      }

      setStep('error');
    }
  }, [capturedBlob, previewUrl, rotationDegrees]);

  const pollDocumentStatus = async (docId: string) => {
    for (let i = 0; i < POLL_MAX_RETRIES; i++) {
      await delay(POLL_INTERVAL_MS);
      try {
        const { status, validationErrors } = await ocrApi.getDocumentStatus(docId);
        setPollStatus(status);

        if (status !== DocumentStatus.PROCESANDO && status !== DocumentStatus.PENDIENTE) {
          setPollErrors(validationErrors);
          setStep('done');

          if (status === DocumentStatus.VALIDO) {
            toast.success('Remito procesado correctamente');
          } else if (status === DocumentStatus.CON_ERRORES) {
            const hasConfigError = validationErrors?.some((e) =>
              e.toLowerCase().includes('error interno') || e.toLowerCase().includes('procesamiento'),
            );
            toast.warning(
              hasConfigError
                ? 'OCR no disponible (pendiente de configuración). El remito fue guardado para revisión manual.'
                : `Remito con errores — quedarán para revisión del equipo ADMIN.`,
            );
          }
          return;
        }
      } catch {
        // Error de red al hacer polling — continuar intentando
      }
    }
    // Timeout
    setPollStatus(DocumentStatus.CON_ERRORES);
    setPollErrors(['Tiempo de procesamiento excedido. El documento quedó en cola de revisión.']);
    setStep('done');
  };

  const resetFlow = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl(null);
    setPollStatus(null);
    setPollErrors(null);
    setUploadPct(0);
    setRotationDegrees(0);
    setStep('idle');
  };

  // ── Cola local (localStorage) ───────────────────────────────────────────────

  const handleDeleteDocument = async (item: QueueItem) => {
    if (!item.documentId) return;
    setDeletingDocId(item.documentId);
    try {
      await ocrApi.deleteDocument(item.documentId);
      removeFromQueue(item.id);
      toast.success('Remito eliminado');
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo eliminar el remito');
    } finally {
      setDeletingDocId(null);
    }
  };

  function addToQueue(item: QueueItem) {
    setQueue((prev) => {
      const updated = [item, ...prev].slice(0, 20);
      localStorage.setItem('ocr-remitos-queue', JSON.stringify(updated));
      return updated;
    });
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      localStorage.setItem('ocr-remitos-queue', JSON.stringify(updated));
      return updated;
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header + conectividad */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Terminal de Remitos</h1>
          <p className="text-sm text-muted-foreground">Captura y sincronización de remitos</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          isOnline
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
        }`}>
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? 'Online' : 'Offline — guardando localmente'}
        </div>
      </div>

      {cameraError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 text-sm text-red-700 dark:text-red-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {cameraError}
        </div>
      )}

      {/* ── Estado: idle ─────────────────────────────────────────── */}
      {step === 'idle' && (
        <>
          {/* Botón principal — abre cámara nativa en mobile, file picker en desktop */}
          <div
            onClick={() => cameraInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Sacar foto del remito</p>
            <p className="text-sm text-muted-foreground mt-1">Toca para abrir la cámara</p>
          </div>

          {/* capture="environment" → cámara trasera en mobile, file picker en desktop */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex gap-2">
            {/* Desde galería / archivo (sin capture) */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
            >
              <Upload className="h-4 w-4" />
              Elegir de galería
            </button>
            {/* Webcam — útil en desktop */}
            <button
              onClick={startCamera}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
            >
              <Camera className="h-4 w-4" />
              Usar webcam
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </>
      )}

      {/* ── Estado: capture (webcam activa) ──────────────────────── */}
      {step === 'capture' && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-black aspect-video flex items-center justify-center relative">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          </div>
          <div className="p-4 flex gap-2 bg-card">
            <button
              onClick={cancelCapture}
              className="flex-1 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-accent flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
            <button
              onClick={captureFrame}
              className="flex-1 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" /> Capturar
            </button>
          </div>
        </div>
      )}

      {/* ── Estado: preview ───────────────────────────────────────── */}
      {step === 'preview' && previewUrl && (
        <div className="border border-border rounded-xl overflow-hidden">
          {capturedBlob && !isPdfBlob(capturedBlob) ? (
            <div className="w-full h-64 bg-black flex items-center justify-center overflow-hidden">
              <img
                src={previewUrl}
                alt="Preview remito"
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{ transform: `rotate(${rotationDegrees}deg)` }}
              />
            </div>
          ) : (
            <div className="w-full min-h-48 bg-muted flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">PDF seleccionado</p>
              <p className="text-xs text-muted-foreground">La rotación desde la terminal está disponible solo para imágenes.</p>
            </div>
          )}
          <div className="p-4 flex flex-col gap-2 bg-card">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => rotatePreview(-90)}
                disabled={!capturedBlob || isPdfBlob(capturedBlob)}
                className="py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Rotar izquierda
              </button>
              <button
                onClick={() => rotatePreview(90)}
                disabled={!capturedBlob || isPdfBlob(capturedBlob)}
                className="py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RotateCw className="h-4 w-4" />
                Rotar derecha
              </button>
            </div>
            <button
              onClick={handleTestExtract}
              disabled={testLoading}
              className="w-full py-2 text-sm rounded-md border border-primary text-primary font-medium hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FlaskConical className="h-4 w-4" /> Probar OCR
            </button>
            <div className="flex gap-2">
              <button
                onClick={cancelCapture}
                className="flex-1 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-accent"
              >
                Descartar
              </button>
              <button
                onClick={uploadDocument}
                className="flex-1 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4" /> Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Estado: uploading ─────────────────────────────────────── */}
      {step === 'uploading' && (
        <div className="border border-border rounded-xl p-6 text-center space-y-4">
          <Upload className="h-10 w-10 mx-auto text-primary animate-bounce" />
          <p className="text-sm font-medium text-foreground">Subiendo imagen…</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{uploadPct}%</p>
        </div>
      )}

      {/* ── Estado: polling (OCR en progreso) ────────────────────── */}
      {step === 'polling' && (
        <div className="border border-border rounded-xl p-6 text-center space-y-3">
          <RefreshCw className="h-10 w-10 mx-auto text-blue-500 animate-spin" />
          <p className="text-sm font-medium text-foreground">Procesando con OCR…</p>
          <p className="text-xs text-muted-foreground">
            El sistema está extrayendo los datos del remito. Puede tardar hasta 30 segundos.
          </p>
          {pollStatus && <StatusBadge status={pollStatus} />}
        </div>
      )}

      {/* ── Estado: done ──────────────────────────────────────────── */}
      {step === 'done' && pollStatus && (
        <div className="border border-border rounded-xl p-6 space-y-4">
          <div className="text-center">
            {pollStatus === DocumentStatus.VALIDO || pollStatus === DocumentStatus.REVISADO ? (
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
            ) : (
              <AlertTriangle className="h-12 w-12 mx-auto text-orange-500 mb-2" />
            )}
            <StatusBadge status={pollStatus} />
          </div>

          {pollErrors && pollErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-200 space-y-1">
              <p className="font-medium">Observaciones:</p>
              {pollErrors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}

          <button
            onClick={resetFlow}
            className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90"
          >
            Subir otro remito
          </button>
        </div>
      )}

      {/* ── Estado: error ─────────────────────────────────────────── */}
      {step === 'error' && (
        <div className="border border-red-200 rounded-xl p-6 text-center space-y-3 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertTriangle className="h-10 w-10 mx-auto text-red-500" />
          <p className="text-sm font-medium text-red-700 dark:text-red-200">No se pudo procesar el remito</p>
          <button onClick={resetFlow} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent">
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* ── Cola de sincronización ──────────────────────────────────── */}
      {queue.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Cola reciente</h2>
          <div className="space-y-2">
            {queue.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                <div className={`p-1.5 rounded-full ${
                  item.status === 'synced' ? 'bg-green-100 dark:bg-green-900/30' :
                  item.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                  'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {item.status === 'synced'
                    ? <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-200" />
                    : item.status === 'pending'
                    ? <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-200" />
                    : <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-200" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {item.documentId ? `ID: ${item.documentId.slice(0, 8)}…` : 'Pendiente de envío'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('es-AR')}
                  </p>
                  {item.errorMsg && (
                    <p className="text-xs text-red-500 truncate">{item.errorMsg}</p>
                  )}
                  {canDeleteFromDb(item) && (
                    <p className="text-xs text-orange-500">
                      Eliminar disponible: {deleteWindowRemaining(item)}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  item.status === 'synced'  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200' :
                  item.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                }`}>
                  {item.status === 'synced' ? 'Enviado' : item.status === 'pending' ? 'Pendiente' : 'Error'}
                </span>
                {canDeleteFromDb(item) ? (
                  <button
                    onClick={() => handleDeleteDocument(item)}
                    disabled={deletingDocId === item.documentId}
                    title="Eliminar remito del sistema"
                    className="p-1 rounded text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 disabled:opacity-50"
                  >
                    {deletingDocId === item.documentId
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    title="Quitar de la lista"
                    className="p-1 rounded text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal test OCR ────────────────────────────────────────── */}
      <OcrTestModal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        loading={testLoading}
        error={testError}
        type={DocumentType.REMITO}
        fields={testFields}
        preview={previewUrl}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadQueue(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem('ocr-remitos-queue') ?? '[]') as QueueItem[];
  } catch {
    return [];
  }
}

async function prepareBlobForOcr(blob: Blob, rotationDegrees: RotationDegrees): Promise<Blob> {
  if (rotationDegrees === 0 || isPdfBlob(blob)) return blob;
  return rotateImageBlob(blob, rotationDegrees);
}

async function rotateImageBlob(blob: Blob, degrees: RotationDegrees): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(sourceUrl);
    const canvas = document.createElement('canvas');
    const isSideways = degrees === 90 || degrees === 270;

    canvas.width  = isSideways ? image.naturalHeight : image.naturalWidth;
    canvas.height = isSideways ? image.naturalWidth : image.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

    const outputType = getRotatedImageType(blob.type);
    const rotated = await canvasToBlob(canvas, outputType);

    if (blob instanceof File) {
      return new File([rotated], blob.name, {
        type:        rotated.type || outputType,
        lastModified: Date.now(),
      });
    }

    return rotated;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    image.src = src;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  const primary = await tryCanvasToBlob(canvas, type);
  if (primary) return primary;

  const fallback = await tryCanvasToBlob(canvas, 'image/jpeg');
  if (fallback) return fallback;

  throw new Error('No se pudo generar la imagen rotada');
}

function tryCanvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      resolve(blob);
    }, type, 0.92);
  });
}

function getRotatedImageType(sourceType: string): string {
  if (sourceType === 'image/png' || sourceType === 'image/webp') return sourceType;
  return 'image/jpeg';
}

function getUploadContentType(blob: Blob): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' {
  if (isPdfBlob(blob)) return 'application/pdf';
  if (blob.type === 'image/png' || blob.type === 'image/webp') return blob.type;
  return 'image/jpeg';
}

function isPdfBlob(blob: Blob): boolean {
  if (blob.type === 'application/pdf') return true;
  return blob instanceof File && blob.name.toLowerCase().endsWith('.pdf');
}

function normalizeRotation(degrees: number): RotationDegrees {
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized as RotationDegrees;
}
