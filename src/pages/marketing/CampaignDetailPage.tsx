import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, RefreshCw, Plus, Trash2, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';
import {
  fetchCampaign,
  fetchRecipients,
  executeCampaign,
  clearCurrentCampaign,
} from '@/store/marketing/campaignsSlice';
import { getCampaignPreview, configureWaves, getCampaignLogs, rescheduleWave, reconfigureScheduledWaves, retryRecipient, updateRecipientPhone } from '@/api/marketing';
import { Button } from '@/components/ui/Button';
import { ExecuteConfirmModal } from './ExecuteConfirmModal';
import type { CampaignRecipient, CampaignPreviewItem, CampaignLog, CampaignWave } from '@/types/marketing.types';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  QUEUED: 'En cola',
  RUNNING: 'Ejecutando',
  COMPLETED: 'Completada',
  FAILED: 'Fallida',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  QUEUED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RUNNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const WAVE_STATUS_CLASSES: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RUNNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const WAVE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programada',
  RUNNING: 'Enviando',
  COMPLETED: 'Completada',
  FAILED: 'Fallida',
};

const REC_STATUS_CLASSES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  SENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SKIPPED: 'bg-muted text-muted-foreground',
};

const REC_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  SENT: 'Enviado',
  FAILED: 'Fallido',
  SKIPPED: 'Omitido',
};

const LOG_LEVEL_CLASSES: Record<string, string> = {
  INFO: 'bg-muted text-muted-foreground',
  WARN: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const LOG_EVENT_LABELS: Record<string, string> = {
  CAMPAIGN_STARTED: 'Campaña iniciada',
  CAMPAIGN_COMPLETED: 'Campaña completada',
  WAVE_STARTED: 'Oleada iniciada',
  WAVE_COMPLETED: 'Oleada completada',
  WAVE_FAILED: 'Oleada fallida',
  WAVE_RESCHEDULED: 'Oleada reprogramada',
  MESSAGE_SENT: 'Mensaje enviado',
  MESSAGE_FAILED: 'Mensaje fallido',
  MESSAGE_RETRY: 'Reintento',
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const YCLOUD_CODE_LABELS: Record<string, string> = {
  PARAM_INVALID: 'Caracteres inválidos',
  BALANCE_INSUFFICIENT: 'Fondos insuficientes',
};

function friendlyError(raw?: string): string {
  if (!raw) return '';
  // Algunos mensajes viejos quedaron como JSON crudo; intentar parsearlos
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const inner = (parsed['error'] ?? parsed) as Record<string, unknown>;
    const code = inner['code'] as string | undefined;
    if (code && YCLOUD_CODE_LABELS[code]) return YCLOUD_CODE_LABELS[code];
    if (inner['message']) return String(inner['message']);
  } catch { /* no era JSON */ }
  // Ya es un mensaje limpio
  if (YCLOUD_CODE_LABELS[raw]) return YCLOUD_CODE_LABELS[raw];
  return raw;
}

function toLocalDatetimeValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

interface WaveDraft {
  scheduledAt: string;
  recipientCount: number;
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentCampaign, recipients, loadingCurrent, loadingRecipients, submitting } =
    useAppSelector((s) => s.marketing);
  const { canEdit } = useCanPerform(ModuleKey.MARKETING);
  const [showConfirm, setShowConfirm] = useState(false);
  const [preview, setPreview] = useState<CampaignPreviewItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [filterAdvisor, setFilterAdvisor] = useState<string>('');
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterSend, setFilterSend] = useState<'all' | 'send' | 'skip'>('all');
  const [search, setSearch] = useState('');

  // Waves configurator
  const [waveDrafts, setWaveDrafts] = useState<WaveDraft[]>([{ scheduledAt: '', recipientCount: 0 }]);
  const [savingWaves, setSavingWaves] = useState(false);

  // Logs
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Reprogramar oleada (fecha)
  const [editingWave, setEditingWave] = useState<number | null>(null);
  const [editingWaveDate, setEditingWaveDate] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);

  // Reconfigurar oleadas programadas (cantidad + fecha)
  const [reconfiguringWaves, setReconfiguringWaves] = useState(false);
  const [reconfWaveDrafts, setReconfWaveDrafts] = useState<WaveDraft[]>([]);
  const [savingReconf, setSavingReconf] = useState(false);

  // Filtro de destinatarios (post-ejecución)
  const [filterRecStatus, setFilterRecStatus] = useState<'all' | 'FAILED' | 'SENT' | 'PENDING'>('all');

  // Retry / editar teléfono
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');

  useEffect(() => {
    if (!id) return;
    void dispatch(fetchCampaign(id));
    void dispatch(fetchRecipients(id));
    return () => { dispatch(clearCurrentCampaign()); };
  }, [dispatch, id]);

  useEffect(() => {
    if (!currentCampaign) return;
    if (currentCampaign.status === 'DRAFT') {
      if (currentCampaign.waves && currentCampaign.waves.length > 0) {
        setWaveDrafts(
          currentCampaign.waves.map((w) => ({
            scheduledAt: toLocalDatetimeValue(w.scheduledAt),
            recipientCount: w.recipientCount,
          })),
        );
      } else {
        setWaveDrafts([{ scheduledAt: '', recipientCount: currentCampaign.totalRecipients }]);
      }
    }
  }, [currentCampaign?.id, currentCampaign?.waves, currentCampaign?.status, currentCampaign?.totalRecipients]);

  useEffect(() => {
    if (!currentCampaign || currentCampaign.status !== 'DRAFT') return;
    if (currentCampaign.waves?.length) return;
    const eligible = preview.filter((p) => p.willSend).length;
    if (eligible === 0) return;
    setWaveDrafts((prev) => {
      if (prev.length === 1 && prev[0].recipientCount === 0 && !prev[0].scheduledAt) {
        return [{ scheduledAt: '', recipientCount: eligible }];
      }
      return prev;
    });
  }, [currentCampaign?.id, currentCampaign?.waves, currentCampaign?.status, preview]);

  // Load preview for DRAFT
  useEffect(() => {
    if (!id || !currentCampaign || currentCampaign.status !== 'DRAFT') return;
    setLoadingPreview(true);
    getCampaignPreview(id)
      .then(setPreview)
      .catch(() => toast.error('No se pudo cargar la vista previa'))
      .finally(() => setLoadingPreview(false));
  }, [id, currentCampaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load logs for non-DRAFT campaigns
  useEffect(() => {
    if (!id || !currentCampaign || currentCampaign.status === 'DRAFT') return;
    setLoadingLogs(true);
    getCampaignLogs(id)
      .then(setLogs)
      .catch(() => {/* silent */})
      .finally(() => setLoadingLogs(false));
  }, [id, currentCampaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExecute() {
    if (!id) return;
    try {
      await dispatch(executeCampaign(id)).unwrap();
      toast.success('Campaña iniciada');
      setShowConfirm(false);
      void dispatch(fetchRecipients(id));
    } catch {
      toast.error('Error al ejecutar la campaña');
    }
  }

  async function handleRefresh() {
    if (!id) return;
    void dispatch(fetchCampaign(id));
    void dispatch(fetchRecipients(id));
    if (currentCampaign && currentCampaign.status !== 'DRAFT') {
      setLoadingLogs(true);
      getCampaignLogs(id)
        .then(setLogs)
        .catch(() => {/* silent */})
        .finally(() => setLoadingLogs(false));
    }
  }

  async function handleSaveWaves() {
    if (!id || !currentCampaign) return;
    const eligible = preview.filter((p) => p.willSend).length;
    const target =
      currentCampaign.totalRecipients > 0 ? currentCampaign.totalRecipients : eligible;
    const total = waveDrafts.reduce((s, w) => s + w.recipientCount, 0);
    if (target > 0 && total !== target) {
      toast.error('La suma de destinatarios por oleada debe coincidir con los elegibles para envío');
      return;
    }
    if (total === 0) {
      toast.error('Asigna al menos 1 destinatario');
      return;
    }
    if (waveDrafts.some((w) => !w.scheduledAt)) {
      toast.error('Completá la fecha y hora de cada oleada');
      return;
    }
    setSavingWaves(true);
    try {
      await configureWaves(
        id,
        waveDrafts.map((w) => ({
          scheduledAt: new Date(w.scheduledAt).toISOString(),
          recipientCount: w.recipientCount,
        })),
      );
      toast.success('Oleadas guardadas');
      void dispatch(fetchCampaign(id));
    } catch {
      toast.error('Error al guardar las oleadas');
    } finally {
      setSavingWaves(false);
    }
  }

  async function handleRescheduleWave(waveNumber: number) {
    if (!id || !editingWaveDate) return;
    setSavingReschedule(true);
    try {
      await rescheduleWave(id, waveNumber, new Date(editingWaveDate).toISOString());
      toast.success(`Oleada ${waveNumber} reprogramada`);
      setEditingWave(null);
      void dispatch(fetchCampaign(id));
    } catch {
      toast.error('Error al reprogramar la oleada');
    } finally {
      setSavingReschedule(false);
    }
  }

  function openReconfigure() {
    if (!currentCampaign) return;
    const scheduled = (currentCampaign.waves ?? []).filter((w) => w.status === 'SCHEDULED');
    setReconfWaveDrafts(
      scheduled.map((w) => ({
        scheduledAt: toLocalDatetimeValue(w.scheduledAt),
        recipientCount: Math.max(0, w.recipientCount - w.sentCount - w.failedCount),
      })),
    );
    setReconfiguringWaves(true);
  }

  async function handleSaveReconf() {
    if (!id) return;
    if (reconfWaveDrafts.some((w) => !w.scheduledAt)) {
      toast.error('Completá la fecha y hora de cada oleada');
      return;
    }
    setSavingReconf(true);
    try {
      await reconfigureScheduledWaves(
        id,
        reconfWaveDrafts.map((w) => ({
          scheduledAt: new Date(w.scheduledAt).toISOString(),
          recipientCount: w.recipientCount,
        })),
      );
      toast.success('Oleadas actualizadas');
      setReconfiguringWaves(false);
      void dispatch(fetchCampaign(id));
    } catch {
      toast.error('Error al reconfigurar las oleadas');
    } finally {
      setSavingReconf(false);
    }
  }

  async function handleRetry(recipientId: string) {
    if (!id) return;
    setRetryingId(recipientId);
    try {
      await retryRecipient(id, recipientId);
      toast.success('Reintento programado');
      void dispatch(fetchRecipients(id));
      void dispatch(fetchCampaign(id));
    } catch {
      toast.error('Error al programar el reintento');
    } finally {
      setRetryingId(null);
    }
  }

  async function handleSavePhone(recipientId: string) {
    if (!id) return;
    try {
      await updateRecipientPhone(id, recipientId, editingPhoneValue.trim());
      toast.success('Teléfono actualizado y reintento programado');
      setEditingPhoneId(null);
      setEditingPhoneValue('');
      void dispatch(fetchRecipients(id));
      void dispatch(fetchCampaign(id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al actualizar el teléfono');
    }
  }

  function addWave() {
    if (waveDrafts.length >= 3) return;
    setWaveDrafts((prev) => [...prev, { scheduledAt: '', recipientCount: 0 }]);
  }

  function removeWave(idx: number) {
    setWaveDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateWave(idx: number, field: keyof WaveDraft, value: string | number) {
    setWaveDrafts((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, [field]: value } : w)),
    );
  }

  const advisors = useMemo(() => [...new Set(preview.map((p) => p.siguiendo))].sort(), [preview]);
  const estados = useMemo(() => [...new Set(preview.map((p) => p.estado).filter(Boolean))].sort(), [preview]);
  const filteredPreview = useMemo(() => preview.filter((p) => {
    if (filterAdvisor && p.siguiendo !== filterAdvisor) return false;
    if (filterEstado && p.estado !== filterEstado) return false;
    if (filterSend === 'send' && !p.willSend) return false;
    if (filterSend === 'skip' && p.willSend) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.customerName.toLowerCase().includes(q) || p.customerPhone.includes(q);
    }
    return true;
  }), [preview, filterAdvisor, filterEstado, filterSend, search]);

  if (loadingCurrent || !currentCampaign) {
    return (
      <div className="p-4 sm:p-6">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const c = currentCampaign;
  const isRunning = c.status === 'RUNNING';
  const isCompleted = c.status === 'COMPLETED';
  const isDraft = c.status === 'DRAFT';

  const byStatus = recipients.reduce<Record<string, CampaignRecipient[]>>((acc, r) => {
    acc[r.status] = acc[r.status] ?? [];
    acc[r.status].push(r);
    return acc;
  }, {});

  const filteredRecipients = filterRecStatus === 'all'
    ? recipients
    : recipients.filter((r) => r.status === filterRecStatus);

  const willSendCount = preview.filter((p) => p.willSend).length;
  const willSkipCount = preview.length - willSendCount;
  const waveTarget = c.totalRecipients > 0 ? c.totalRecipients : willSendCount;
  const waveTotal = waveDrafts.reduce((s, w) => s + w.recipientCount, 0);
  const waveCountError =
    isDraft && waveTarget > 0 && waveTotal !== waveTarget
      ? `La suma (${waveTotal}) debe coincidir con destinatarios a enviar (${waveTarget})`
      : '';

  const scheduledWaves = (c.waves ?? []).filter((w) => w.status === 'SCHEDULED');
  const pendingInScheduled = scheduledWaves.reduce((s, w) => s + w.recipientCount - w.sentCount - w.failedCount, 0);
  const reconfTotal = reconfWaveDrafts.reduce((s, w) => s + w.recipientCount, 0);
  const reconfError =
    reconfTotal !== pendingInScheduled
      ? `La suma (${reconfTotal}) debe coincidir con pendientes en oleadas programadas (${pendingInScheduled})`
      : '';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/marketing/campaigns')}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{c.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Plantilla: {c.templateName} · {c.templateLanguage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[c.status] ?? ''}`}>
            {STATUS_LABELS[c.status] ?? c.status}
          </span>

          {(isRunning || isCompleted) && (
            <button
              onClick={() => void handleRefresh()}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Actualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          {c.status === 'DRAFT' && (
            <Button size="sm" onClick={() => setShowConfirm(true)} disabled={!canEdit}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Ejecutar
            </Button>
          )}
        </div>
      </div>

      {/* Hoja de trabajo — solo para DRAFT */}
      {isDraft && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Hoja de trabajo</h3>
                {!loadingPreview && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {preview.length} clientes encontrados ·{' '}
                    <span className="text-green-600 dark:text-green-400">{willSendCount} se enviarán</span>
                    {willSkipCount > 0 && (
                      <span className="text-muted-foreground"> · {willSkipCount} se omitirán</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {!loadingPreview && preview.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <input
                  type="text"
                  placeholder="Buscar nombre o teléfono…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
                />
                <select
                  value={filterAdvisor}
                  onChange={(e) => setFilterAdvisor(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Todos los asesores</option>
                  {advisors.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Todos los estados</option>
                  {estados.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  {(['all', 'send', 'skip'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFilterSend(v)}
                      className={[
                        'px-2.5 py-1 transition-colors',
                        filterSend === v
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:bg-muted',
                      ].join(' ')}
                    >
                      {v === 'all' ? 'Todos' : v === 'send' ? 'Se envían' : 'Se omiten'}
                    </button>
                  ))}
                </div>
                {(filterAdvisor || filterEstado || filterSend !== 'all' || search) && (
                  <button
                    onClick={() => { setFilterAdvisor(''); setFilterEstado(''); setFilterSend('all'); setSearch(''); }}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>

          {loadingPreview ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : filteredPreview.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              {preview.length === 0 ? 'No hay clientes que coincidan con los filtros de la campaña.' : 'Sin resultados para los filtros aplicados.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Teléfono</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Asesor (envía desde)</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Estado CRM</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Producto</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPreview.map((p) => (
                    <tr key={p.customerId} className={p.willSend ? 'hover:bg-muted/50' : 'opacity-50 hover:bg-muted/50'}>
                      <td className="px-4 py-2.5 text-foreground font-medium">{p.customerName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.customerPhone || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.willSend ? (
                          <div>
                            <span className="font-medium text-foreground">{p.siguiendo}</span>
                            <span className="text-xs text-muted-foreground ml-1">({p.phoneNumberId})</span>
                          </div>
                        ) : (
                          <span>{p.siguiendo}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.estado || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{p.producto || '—'}</td>
                      <td className="px-4 py-2.5">
                        {p.willSend ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Enviar
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground" title={p.skipReason}>
                            Omitir
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loadingPreview && filteredPreview.length > 0 && filteredPreview.length !== preview.length && (
            <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
              Mostrando {filteredPreview.length} de {preview.length} clientes
            </div>
          )}
        </div>
      )}

      {/* Configurador de oleadas — solo DRAFT */}
      {isDraft && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Oleadas de envío</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dividí el envío en hasta 3 partes, cada una en una fecha/hora diferente.
                Total asignado: <span className={waveCountError ? 'text-destructive font-medium' : 'font-medium'}>{waveTotal}</span>
                {' '}/ {waveTarget}
              </p>
            </div>
            {waveDrafts.length < 3 && canEdit && (
              <button
                onClick={addWave}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar oleada
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            {waveDrafts.map((wave, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
                  Oleada {idx + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    value={wave.scheduledAt}
                    onChange={(e) => updateWave(idx, 'scheduledAt', e.target.value)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Destinatarios</label>
                  <input
                    type="number"
                    min={1}
                    max={waveTarget || undefined}
                    value={wave.recipientCount || ''}
                    onChange={(e) => updateWave(idx, 'recipientCount', parseInt(e.target.value) || 0)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground w-24 focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Cantidad"
                  />
                </div>
                {waveDrafts.length > 1 && (
                  <button
                    onClick={() => removeWave(idx)}
                    className="ml-auto p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {waveCountError && (
              <p className="text-xs text-destructive">{waveCountError}</p>
            )}

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSaveWaves()}
                disabled={!canEdit || savingWaves || !!waveCountError || waveTarget === 0}
              >
                {savingWaves ? 'Guardando…' : 'Guardar oleadas'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: c.totalRecipients },
          { label: 'Enviados', value: c.sentCount, positive: true },
          { label: 'Fallidos', value: c.failedCount, negative: true },
          { label: 'Omitidos', value: c.skippedCount },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
            <p className={[
              'mt-1 text-2xl font-bold',
              kpi.positive && kpi.value > 0 ? 'text-green-600 dark:text-green-400' : '',
              kpi.negative && kpi.value > 0 ? 'text-destructive' : '',
              !kpi.positive && !kpi.negative ? 'text-foreground' : '',
            ].filter(Boolean).join(' ')}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Progreso */}
      {c.totalRecipients > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-foreground">Progreso</span>
            <span className="text-muted-foreground">{c.sentCount + c.failedCount + c.skippedCount} / {c.totalRecipients}</span>
          </div>
          <ProgressBar value={c.sentCount + c.failedCount + c.skippedCount} max={c.totalRecipients} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground pt-1">
            <span>Creada: {formatDate(c.createdAt)}</span>
            {c.startedAt && <span>Iniciada: {formatDate(c.startedAt)}</span>}
            {c.completedAt && <span>Completada: {formatDate(c.completedAt)}</span>}
            {c.pendingCount > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">{c.pendingCount} pendientes</span>
            )}
          </div>
        </div>
      )}

      {/* Oleadas — estado (RUNNING / COMPLETED / QUEUED) */}
      {!isDraft && c.waves && c.waves.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Oleadas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Programada</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Destinatarios</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Enviados</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fallidos</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Completada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {c.waves.map((wave: CampaignWave) => (
                  <tr key={wave.waveNumber} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-medium text-foreground">{wave.waveNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {editingWave === wave.waveNumber ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="datetime-local"
                            value={editingWaveDate}
                            onChange={(e) => setEditingWaveDate(e.target.value)}
                            className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <button
                            onClick={() => void handleRescheduleWave(wave.waveNumber)}
                            disabled={savingReschedule || !editingWaveDate}
                            className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                            title="Confirmar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingWave(null)}
                            disabled={savingReschedule}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>{formatDate(wave.scheduledAt)}</span>
                          {isRunning && wave.status === 'SCHEDULED' && (
                            <button
                              onClick={() => {
                                setEditingWave(wave.waveNumber);
                                setEditingWaveDate(toLocalDatetimeValue(wave.scheduledAt));
                              }}
                              className="p-1 text-muted-foreground hover:text-foreground rounded"
                              title="Reprogramar"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{wave.recipientCount}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-green-600 dark:text-green-400 font-medium">{wave.sentCount}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {wave.failedCount > 0 ? (
                        <span className="text-destructive font-medium">{wave.failedCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const displayStatus = isCompleted && wave.status === 'RUNNING' ? 'COMPLETED' : wave.status;
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${WAVE_STATUS_CLASSES[displayStatus] ?? ''}`}>
                            {WAVE_STATUS_LABELS[displayStatus] ?? displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap hidden md:table-cell">
                      {formatDate(wave.completedAt) !== '—' ? formatDate(wave.completedAt) : (isCompleted && wave.status === 'RUNNING' ? formatDate(c.completedAt) : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reconfigurar oleadas programadas — solo RUNNING con waves SCHEDULED */}
      {isRunning && scheduledWaves.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Reconfigurar oleadas programadas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {scheduledWaves.length} oleada{scheduledWaves.length > 1 ? 's' : ''} pendiente{scheduledWaves.length > 1 ? 's' : ''} ·{' '}
                {pendingInScheduled} destinatarios por asignar
              </p>
            </div>
            {!reconfiguringWaves ? (
              <Button size="sm" variant="outline" onClick={openReconfigure} disabled={!canEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Button>
            ) : (
              <button
                onClick={() => setReconfiguringWaves(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {reconfiguringWaves && (
            <div className="p-4 space-y-3">
              {reconfWaveDrafts.map((wave, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
                    Oleada {idx + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Fecha y hora</label>
                    <input
                      type="datetime-local"
                      value={wave.scheduledAt}
                      onChange={(e) => setReconfWaveDrafts((prev) => prev.map((w, i) => i === idx ? { ...w, scheduledAt: e.target.value } : w))}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Destinatarios</label>
                    <input
                      type="number"
                      min={1}
                      value={wave.recipientCount || ''}
                      onChange={(e) => setReconfWaveDrafts((prev) => prev.map((w, i) => i === idx ? { ...w, recipientCount: parseInt(e.target.value) || 0 } : w))}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground w-24 focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Cantidad"
                    />
                  </div>
                  {reconfWaveDrafts.length > 1 && (
                    <button
                      onClick={() => setReconfWaveDrafts((prev) => prev.filter((_, i) => i !== idx))}
                      className="ml-auto p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {reconfWaveDrafts.length < 5 && (
                <button
                  onClick={() => setReconfWaveDrafts((prev) => [...prev, { scheduledAt: '', recipientCount: 0 }])}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-3 py-2 w-full justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar oleada
                </button>
              )}

              {reconfError && <p className="text-xs text-destructive">{reconfError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setReconfiguringWaves(false)} disabled={savingReconf}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSaveReconf()}
                  disabled={savingReconf || !!reconfError || reconfWaveDrafts.some((w) => !w.scheduledAt)}
                >
                  {savingReconf ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <ExecuteConfirmModal
          campaign={c}
          submitting={submitting}
          onConfirm={() => void handleExecute()}
          onClose={() => setShowConfirm(false)}
        />
      )}

      {/* Informe de destinatarios */}
      {recipients.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">
              Destinatarios
              <span className="ml-2 text-muted-foreground font-normal">({recipients.length})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {/* Badges de totales — clicables para filtrar */}
              <button
                onClick={() => setFilterRecStatus('all')}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-opacity ${filterRecStatus === 'all' ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100'} bg-muted text-muted-foreground`}
              >
                Todos: {recipients.length}
              </button>
              {Object.entries(byStatus).map(([status, list]) => (
                <button
                  key={status}
                  onClick={() => setFilterRecStatus(filterRecStatus === status ? 'all' : status as any)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-opacity ${filterRecStatus === status ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100'} ${REC_STATUS_CLASSES[status] ?? ''}`}
                >
                  {REC_STATUS_LABELS[status] ?? status}: {list.length}
                </button>
              ))}
            </div>
          </div>

          {loadingRecipients ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Teléfono</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Asesor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Oleada</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Detalle</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Enviado</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecipients.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-foreground">{r.customerName || '—'}</td>
                      {/* Teléfono — editable inline cuando está en edición */}
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {editingPhoneId === r.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              className="border border-border rounded px-1.5 py-0.5 text-xs w-36 bg-background text-foreground"
                              value={editingPhoneValue}
                              onChange={(e) => setEditingPhoneValue(e.target.value)}
                              placeholder="+5491122334455"
                              autoFocus
                            />
                            <button
                              onClick={() => void handleSavePhone(r.id)}
                              className="text-green-600 hover:text-green-700 p-0.5"
                              title="Guardar"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingPhoneId(null); setEditingPhoneValue(''); }}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                              title="Cancelar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          r.customerPhone
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{r.siguiendo}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                        {r.waveNumber != null ? `#${r.waveNumber}` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REC_STATUS_CLASSES[r.status] ?? ''}`}>
                          {REC_STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] hidden md:table-cell">
                        {r.skipReason && <span className="text-xs">{r.skipReason}</span>}
                        {r.errorMessage && !r.skipReason && (
                          <span className="text-xs text-destructive" title={friendlyError(r.errorMessage)}>
                            {friendlyError(r.errorMessage)}
                          </span>
                        )}
                        {r.yCloudMessageId && (
                          <span className="text-xs font-mono">{r.yCloudMessageId}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                        {r.sentAt ? formatDate(r.sentAt) : '—'}
                      </td>
                      {/* Acciones — solo para FAILED */}
                      <td className="px-4 py-2.5">
                        {r.status === 'FAILED' && editingPhoneId !== r.id && canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => void handleRetry(r.id)}
                              disabled={retryingId === r.id}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
                              title="Reintentar"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingPhoneId(r.id); setEditingPhoneValue(r.customerPhone); }}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Editar teléfono y reintentar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {!isDraft && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Log de eventos
              {logs.length > 0 && (
                <span className="ml-2 text-muted-foreground font-normal">({logs.length})</span>
              )}
            </h3>
          </div>

          {loadingLogs ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin eventos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nivel</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Oleada</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Evento</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap text-xs">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LOG_LEVEL_CLASSES[log.level] ?? ''}`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs hidden sm:table-cell">
                        {log.waveNumber != null ? `#${log.waveNumber}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-foreground text-xs font-medium">
                        {LOG_EVENT_LABELS[log.event] ?? log.event}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {log.recipientPhone || '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs hidden lg:table-cell max-w-[240px] truncate">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
