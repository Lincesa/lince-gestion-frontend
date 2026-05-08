import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, ChevronRight, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchCampaigns,
  fetchTemplates,
  fetchFilterOptions,
  createCampaign,
  executeCampaign,
  deleteCampaign,
} from '@/store/marketing/campaignsSlice';
import { previewByFilter } from '@/api/marketing';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ExecuteConfirmModal } from './ExecuteConfirmModal';
import { SendSingleModal } from './SendSingleModal';
import type { Campaign, CampaignPreviewItem, YCloudTemplate, CreateCampaignPayload } from '@/types/marketing.types';

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

const ADVISORS = ['EZEQUIEL', 'DENIS', 'MARTIN', 'JULIAN'];
const ESTADOS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'NO_CONTESTO', label: 'No contestó' },
  { value: 'SE_COTIZO_Y_PENDIENTE', label: 'Cotizado pendiente' },
  { value: 'SE_COTIZO_Y_NO_INTERESO', label: 'No interesó' },
  { value: 'COMPRO', label: 'Compró' },
  { value: 'DERIVADO_A_DISTRIBUIDOR', label: 'Derivado a distribuidor' },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── Wizard de nueva campaña ─────────────────────────────────────────────────

interface WizardProps {
  templates: YCloudTemplate[];
  loadingTemplates: boolean;
  productos: string[];
  submitting: boolean;
  onSubmit: (payload: CreateCampaignPayload) => void;
  onClose: () => void;
}

interface WaveDraft {
  scheduledAt: string;
  recipientCount: number;
}

function NewCampaignWizard({ templates, loadingTemplates, productos, submitting, onSubmit, onClose }: WizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<YCloudTemplate | null>(null);
  const [filterAdvisors, setFilterAdvisors] = useState<string[]>([]);
  const [filterEstados, setFilterEstados] = useState<string[]>([]);
  const [filterProductos, setFilterProductos] = useState<string[]>([]);
  const [previewItems, setPreviewItems] = useState<CampaignPreviewItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewFilterSend, setPreviewFilterSend] = useState<'all' | 'send' | 'skip'>('all');
  const [waveDrafts, setWaveDrafts] = useState<WaveDraft[]>([{ scheduledAt: '', recipientCount: 0 }]);

  const inputClass =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  function toggleAdvisor(a: string) {
    setFilterAdvisors((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }
  function toggleEstado(e: string) {
    setFilterEstados((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }
  function toggleProducto(p: string) {
    setFilterProductos((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  async function goToPreview() {
    setLoadingPreview(true);
    setStep(3);
    try {
      const items = await previewByFilter({
        siguiendo: filterAdvisors.length > 0 ? filterAdvisors : undefined,
        estado: filterEstados.length > 0 ? filterEstados : undefined,
        producto: filterProductos.length > 0 ? filterProductos : undefined,
      });
      setPreviewItems(items);
    } catch {
      toast.error('No se pudo cargar la vista previa');
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleSubmit() {
    if (!name.trim() || !selectedTemplate) return;
    onSubmit({
      name: name.trim(),
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language,
      templateHeaderImageUrl: selectedTemplate.headerExample,
      recipientFilter: {
        siguiendo: filterAdvisors.length > 0 ? filterAdvisors : undefined,
        estado: filterEstados.length > 0 ? filterEstados : undefined,
        producto: filterProductos.length > 0 ? filterProductos : undefined,
      },
      waves: waveDrafts.map((w) => ({
        scheduledAt: new Date(w.scheduledAt).toISOString(),
        recipientCount: w.recipientCount,
      })),
    });
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

  function goToConfirmStep() {
    if (waveDrafts.some((w) => !w.scheduledAt)) {
      toast.error('Completá la fecha y hora de cada oleada');
      return;
    }
    const total = waveDrafts.reduce((s, w) => s + w.recipientCount, 0);
    if (total !== willSendCount) {
      toast.error('La suma de destinatarios por oleada debe coincidir con los que se enviarán');
      return;
    }
    if (total === 0) return;
    setStep(5);
  }

  const canGoToStep2 = name.trim().length > 0 && selectedTemplate !== null;

  const filteredPreview = useMemo(() => previewItems.filter((p) => {
    if (previewFilterSend === 'send' && !p.willSend) return false;
    if (previewFilterSend === 'skip' && p.willSend) return false;
    if (previewSearch) {
      const q = previewSearch.toLowerCase();
      return p.customerName.toLowerCase().includes(q) || p.customerPhone.includes(q);
    }
    return true;
  }), [previewItems, previewFilterSend, previewSearch]);

  const willSendCount = previewItems.filter((p) => p.willSend).length;
  const willSkipCount = previewItems.length - willSendCount;

  const waveTotal = waveDrafts.reduce((s, w) => s + w.recipientCount, 0);
  const waveSumError = willSendCount > 0 && waveTotal !== willSendCount;

  const STEP_LABELS = ['Plantilla', 'Destinatarios', 'Vista previa', 'Oleadas', 'Confirmar'];

  return (
    <Dialog open onClose={onClose} title="Nueva campaña">
      {/* Indicador de pasos */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {([1, 2, 3, 4, 5] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={[
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
              step === s ? 'bg-primary text-primary-foreground'
                : step > s ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground',
            ].join(' ')}>
              {s}
            </div>
            {s < 5 && <div className={`h-px w-6 sm:w-8 ${step > s ? 'bg-primary/40' : 'bg-border'}`} />}
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-2 w-full sm:w-auto">{STEP_LABELS[step - 1]}</span>
      </div>

      {/* Paso 1 — Nombre + plantilla */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre de la campaña</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Campaña reactivación mayo"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Plantilla aprobada en YCloud</label>
            {loadingTemplates ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse bg-muted rounded-md" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay plantillas aprobadas en YCloud.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t)}
                    className={[
                      'w-full text-left rounded-md border p-3 transition-colors',
                      selectedTemplate?.id === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground">{t.name}</span>
                        {(t.channelLabel || t.wabaId) && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                            {t.channelLabel ?? `WABA ${t.wabaId.slice(-6)}`}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{t.language} · {t.category}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!canGoToStep2} onClick={() => setStep(2)}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Paso 2 — Filtros */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Filtrá los destinatarios. Si no seleccionás nada, se incluyen todos los clientes con teléfono y asesor configurado.
          </p>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Asesores</label>
            <div className="flex flex-wrap gap-2">
              {ADVISORS.map((a) => (
                <button key={a} type="button" onClick={() => toggleAdvisor(a)}
                  className={['px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    filterAdvisors.includes(a) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'].join(' ')}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Estado del cliente</label>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <button key={e.value} type="button" onClick={() => toggleEstado(e.value)}
                  className={['px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    filterEstados.includes(e.value) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'].join(' ')}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {productos.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Producto consultado</label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {productos.map((p) => (
                  <button key={p} type="button" onClick={() => toggleProducto(p)}
                    className={['px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      filterProductos.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'].join(' ')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>Atrás</Button>
            <Button size="sm" onClick={() => void goToPreview()}>Ver destinatarios</Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Vista previa de destinatarios */}
      {step === 3 && (
        <div className="space-y-3">
          {loadingPreview ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{previewItems.length}</span> clientes ·{' '}
                  <span className="text-green-600 dark:text-green-400 font-medium">{willSendCount} se enviarán</span>
                  {willSkipCount > 0 && <span> · {willSkipCount} se omitirán</span>}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Buscar…"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
                  />
                  <div className="flex rounded-md border border-border overflow-hidden text-xs">
                    {(['all', 'send', 'skip'] as const).map((v) => (
                      <button key={v} onClick={() => setPreviewFilterSend(v)}
                        className={['px-2 py-1 transition-colors',
                          previewFilterSend === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'].join(' ')}>
                        {v === 'all' ? 'Todos' : v === 'send' ? 'Envían' : 'Omiten'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <div className="overflow-y-auto max-h-72">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cliente</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Teléfono</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asesor</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado CRM</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPreview.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sin resultados</td>
                        </tr>
                      ) : filteredPreview.map((p) => (
                        <tr key={p.customerId} className={p.willSend ? 'hover:bg-muted/50' : 'opacity-50 hover:bg-muted/50'}>
                          <td className="px-3 py-2 font-medium text-foreground">{p.customerName}</td>
                          <td className="px-3 py-2 text-muted-foreground font-mono">{p.customerPhone || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.siguiendo}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.estado || '—'}</td>
                          <td className="px-3 py-2">
                            {p.willSend ? (
                              <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Enviar</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground" title={p.skipReason}>Omitir</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>Atrás</Button>
            <Button
              size="sm"
              disabled={willSendCount === 0}
              onClick={() => {
                setWaveDrafts([{ scheduledAt: '', recipientCount: willSendCount }]);
                setStep(4);
              }}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Paso 4 — Oleadas */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Partí el envío en hasta 3 oleadas. La suma de destinatarios debe ser exactamente{' '}
            <span className="font-medium text-foreground">{willSendCount}</span> (los que se enviarán según la vista previa).
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Total asignado:{' '}
              <span className={waveSumError ? 'text-destructive font-medium' : 'font-medium text-foreground'}>
                {waveTotal}
              </span>
              {' '}/ {willSendCount}
            </p>
            {waveDrafts.length < 3 && (
              <button
                type="button"
                onClick={addWave}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar oleada
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {waveDrafts.map((wave, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
              >
                <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">
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
                    max={willSendCount}
                    value={wave.recipientCount || ''}
                    onChange={(e) => updateWave(idx, 'recipientCount', parseInt(e.target.value, 10) || 0)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground w-24 focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Cantidad"
                  />
                </div>
                {waveDrafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWave(idx)}
                    className="ml-auto p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {waveSumError && (
            <p className="text-xs text-destructive">
              La suma debe ser exactamente {willSendCount} destinatarios.
            </p>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep(3)}>Atrás</Button>
            <Button
              size="sm"
              disabled={waveSumError || waveTotal === 0}
              onClick={() => goToConfirmStep()}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Paso 5 — Confirmar y crear */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nombre</span>
              <span className="font-medium text-foreground">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plantilla</span>
              <span className="font-medium text-foreground">{selectedTemplate?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Asesores</span>
              <span className="font-medium text-foreground">{filterAdvisors.length > 0 ? filterAdvisors.join(', ') : 'Todos'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estados</span>
              <span className="font-medium text-foreground text-right max-w-[200px]">
                {filterEstados.length > 0 ? filterEstados.map((e) => ESTADOS.find((x) => x.value === e)?.label ?? e).join(', ') : 'Todos'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Productos</span>
              <span className="font-medium text-foreground text-right max-w-[200px]">
                {filterProductos.length > 0 ? filterProductos.join(', ') : 'Todos'}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <span className="text-muted-foreground">Se enviarán a</span>
              <span className="font-medium text-green-600 dark:text-green-400">{willSendCount} clientes</span>
            </div>
            <div className="border-t border-border pt-2 mt-2 space-y-1">
              <span className="text-muted-foreground text-xs">Oleadas ({waveDrafts.length})</span>
              {waveDrafts.map((w, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <span className="text-foreground">
                    {w.recipientCount} dest. ·{' '}
                    {w.scheduledAt
                      ? new Date(w.scheduledAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            La campaña se creará como borrador con las oleadas guardadas. Podrás ejecutarla desde el detalle o el listado.
          </p>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep(4)}>Atrás</Button>
            <Button size="sm" loading={submitting} disabled={!name.trim() || !selectedTemplate} onClick={handleSubmit}>
              Crear campaña
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function CampaignsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { campaigns, templates, filterOptions, loadingCampaigns, loadingTemplates, submitting } =
    useAppSelector((s) => s.marketing);

  const [showWizard, setShowWizard] = useState(false);
  const [showSendSingle, setShowSendSingle] = useState(false);
  const [confirmCampaign, setConfirmCampaign] = useState<Campaign | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchCampaigns());
  }, [dispatch]);

  useEffect(() => {
    if ((showWizard || showSendSingle) && templates.length === 0) {
      void dispatch(fetchTemplates());
    }
    if (showWizard && filterOptions.productos.length === 0) {
      void dispatch(fetchFilterOptions());
    }
  }, [dispatch, showWizard, showSendSingle, templates.length, filterOptions.productos.length]);

  async function handleCreate(payload: CreateCampaignPayload) {
    try {
      const result = await dispatch(createCampaign(payload)).unwrap();
      toast.success('Campaña creada');
      setShowWizard(false);
      navigate(`/marketing/campaigns/${result.id}`);
    } catch {
      toast.error('Error al crear la campaña');
    }
  }

  async function handleExecute() {
    if (!confirmCampaign) return;
    const id = confirmCampaign.id;
    setExecutingId(id);
    try {
      await dispatch(executeCampaign(id)).unwrap();
      toast.success('Campaña iniciada');
      setConfirmCampaign(null);
      navigate(`/marketing/campaigns/${id}`);
    } catch {
      toast.error('Error al ejecutar la campaña');
    } finally {
      setExecutingId(null);
    }
  }

  async function handleDelete(campaign: Campaign) {
    if (!window.confirm(`¿Eliminar la campaña "${campaign.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(campaign.id);
    try {
      await dispatch(deleteCampaign(campaign.id)).unwrap();
      toast.success('Campaña eliminada');
    } catch {
      toast.error('Error al eliminar la campaña');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Campañas</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSendSingle(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Envío rápido
          </Button>
          <Button size="sm" onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva campaña
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {!loadingCampaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: campaigns.length },
            { label: 'Ejecutando', value: campaigns.filter((c) => c.status === 'RUNNING').length },
            { label: 'Completadas', value: campaigns.filter((c) => c.status === 'COMPLETED').length },
            {
              label: 'Enviados (total)',
              value: campaigns.reduce((acc, c) => acc + c.sentCount, 0),
            },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {loadingCampaigns ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <p className="text-sm text-muted-foreground mb-3">No hay campañas todavía.</p>
          <Button size="sm" onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Crear primera campaña
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Plantilla</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Enviados</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Fallidos</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Creada</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/marketing/campaigns/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.templateName}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right text-foreground hidden sm:table-cell">{c.sentCount}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {c.failedCount > 0 ? (
                        <span className="text-destructive">{c.failedCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {c.status === 'DRAFT' && (
                          <>
                            <button
                              disabled={executingId === c.id}
                              onClick={() => setConfirmCampaign(c)}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                            >
                              <Play className="h-3 w-3" />
                              <span className="hidden sm:inline">Ejecutar</span>
                            </button>
                            <button
                              disabled={deletingId === c.id}
                              onClick={() => void handleDelete(c)}
                              className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                              title="Eliminar borrador"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/marketing/campaigns/${c.id}`)}
                          className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showWizard && (
        <NewCampaignWizard
          templates={templates}
          loadingTemplates={loadingTemplates}
          productos={filterOptions.productos}
          submitting={submitting}
          onSubmit={(p) => void handleCreate(p)}
          onClose={() => setShowWizard(false)}
        />
      )}

      {confirmCampaign && (
        <ExecuteConfirmModal
          campaign={confirmCampaign}
          submitting={submitting}
          onConfirm={() => void handleExecute()}
          onClose={() => setConfirmCampaign(null)}
        />
      )}

      {showSendSingle && (
        <SendSingleModal
          templates={templates}
          loadingTemplates={loadingTemplates}
          onClose={() => setShowSendSingle(false)}
        />
      )}
    </div>
  );
}
