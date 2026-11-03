import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, FileText, Plus, RefreshCw, Settings, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { uploadToS3 } from '@/api/ocr';
import { logisticaApi } from '@/api/logistica';
import { isFieldUser } from '@/auth/profile';
import { useCanPerform } from '@/hooks/useCanPerform';
import { useAppSelector } from '@/store';
import { ModuleKey } from '@/types/auth.types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import type {
  ComplianceCadence,
  ComplianceFileView,
  ComplianceOverviewRow,
  ComplianceSlotView,
  ComplianceStatus,
  ComplianceSummary,
  VehicleKind,
  VehicleView,
} from '@/types/logistica.types';
import { defaultExpiryFor } from './documentacion/expiry';
import { OverviewBoard } from './documentacion/OverviewBoard';
import { complianceAbilities, type ComplianceAbilities } from './documentacion/permissions';
import { STATUS_LABEL, StatusBadge } from './documentacion/status';
import { CADENCE_LABEL, TypesConfigDialog } from './documentacion/TypesConfigDialog';

const KIND_LABEL: Record<VehicleKind, string> = {
  camion: 'Camión',
  batea: 'Batea',
  otro: 'Otro',
};

type StatusFilter = 'all' | ComplianceStatus;
type PageView = 'detail' | 'board';
type DniSide = 'front' | 'back';

const SIDE_LABEL: Record<DniSide, string> = { front: 'Frente', back: 'Dorso' };

/** Two-sided documents (DNI, carnet, cédula verde) need front and back as separate files. */
function isTwoSided(slot: Pick<ComplianceSlotView, 'twoSided' | 'typeKey'>): boolean {
  // Older API responses carried no flag and only DNI had sides.
  return slot.twoSided ?? slot.typeKey === 'dni';
}

function mimeFromFile(file: File): string | null {
  const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
  if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(type)) return type;
  return null;
}

function ReviewBadge({ file }: { file: ComplianceFileView }) {
  if (file.reviewStatus === 'APPROVED') {
    const by = [file.reviewedByName, file.reviewedAt?.slice(0, 10)].filter(Boolean).join(' · ');
    return (
      <Badge className="bg-emerald-600 text-white" title={by ? `Aprobado por ${by}` : undefined}>
        Aprobado{file.reviewedByName ? ` · ${file.reviewedByName}` : ''}
      </Badge>
    );
  }
  // NONE, PENDING and (not produced yet) REJECTED all wait for review.
  return <Badge variant="secondary">Pendiente de revisión</Badge>;
}

export function DocumentacionHeader({
  abilities,
  view,
  onView,
  onConfigure,
  onRefresh,
}: {
  abilities: ComplianceAbilities;
  view: PageView;
  onView: (view: PageView) => void;
  onConfigure: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 justify-between">
      <div>
        <h1 className="text-xl font-semibold">Documentación</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todo opcional. El estado es visual: no bloquea remitos ni viajes.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {abilities.isOffice && (
          <div className="inline-flex rounded-md border p-0.5">
            {(['board', 'detail'] as PageView[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onView(key)}
                className={[
                  'rounded px-3 py-1 text-xs font-medium',
                  view === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {key === 'board' ? 'Tablero' : 'Por transporte'}
              </button>
            ))}
          </div>
        )}
        {abilities.canConfigureTypes && (
          <Button variant="outline" size="sm" onClick={onConfigure}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar tipos
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>
    </div>
  );
}

export function DocumentacionPage() {
  const user = useAppSelector((s) => s.auth.user);
  const { canEdit, canAdmin } = useCanPerform(ModuleKey.LOGISTICA);
  const abilities = complianceAbilities({
    isField: isFieldUser(user),
    globalRole: user?.globalRole,
    canEdit,
    canAdmin,
  });
  const [view, setView] = useState<PageView>('detail');
  const [overviewRows, setOverviewRows] = useState<ComplianceOverviewRow[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [transports, setTransports] = useState<Array<{ id: string; name: string }>>([]);
  const [transportId, setTransportId] = useState('');
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [openEmpresa, setOpenEmpresa] = useState(true);
  const [openChofer, setOpenChofer] = useState<string | null>(null);
  const [openVehicle, setOpenVehicle] = useState<string | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ plate: '', label: '', kind: 'camion' as VehicleKind });
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [preview, setPreview] = useState<{ url: string; contentType: string; name: string } | null>(null);
  const [expiryFile, setExpiryFile] = useState<ComplianceFileView | null>(null);
  const [expiryValue, setExpiryValue] = useState('');
  const [expiryHint, setExpiryHint] = useState<ComplianceCadence | null>(null);

  const loadTransports = useCallback(async () => {
    try {
      const list = await logisticaApi.listComplianceTransports();
      setTransports(list);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron cargar los transportes');
    }
  }, []);

  const loadSummary = useCallback(async (id: string) => {
    if (!id) {
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      setSummary(await logisticaApi.getComplianceSummary(id));
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo cargar la documentación');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await logisticaApi.getComplianceOverview();
      setOverviewRows(data.rows);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo cargar el tablero');
      setOverviewRows([]);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransports();
  }, [loadTransports]);

  useEffect(() => {
    if (view === 'board' && abilities.isOffice) void loadOverview();
  }, [abilities.isOffice, loadOverview, view]);

  useEffect(() => {
    void loadSummary(transportId);
  }, [loadSummary, transportId]);

  const slots = useMemo(() => {
    const all = summary?.slots ?? [];
    if (filter === 'all') return all;
    return all.filter((slot) => slot.status === filter);
  }, [filter, summary]);

  const counts = useMemo(() => {
    const all = summary?.slots ?? [];
    return {
      missing: all.filter((s) => s.status === 'missing').length,
      expiring: all.filter((s) => s.status === 'expiring').length,
      expired: all.filter((s) => s.status === 'expired').length,
    };
  }, [summary]);

  const uploadSlot = async (
    slot: ComplianceSlotView,
    file: File,
    replaceFileId?: string,
    dniSide?: DniSide,
  ) => {
    if (!summary) return;
    const twoSided = isTwoSided(slot);
    if (twoSided && !dniSide) {
      toast.error(`Elegí frente o dorso de ${slot.label}`);
      return;
    }
    const contentType = mimeFromFile(file);
    if (!contentType) {
      toast.error('Solo se aceptan foto (JPG/PNG/WEBP) o PDF');
      return;
    }
    try {
      const url = await logisticaApi.requestComplianceUploadUrl({
        transportId: summary.transportId,
        typeKey: slot.typeKey,
        ...(twoSided && dniSide ? { dniSide } : {}),
        contentType,
        originalName: file.name,
        subjectUserId: slot.subjectUserId ?? undefined,
        vehicleId: slot.vehicleId ?? undefined,
        replaceFileId,
      });
      await uploadToS3(url.uploadUrl, file, contentType);
      const confirmed = await logisticaApi.confirmComplianceUpload(url.fileId);
      toast.success(twoSided && dniSide ? `${SIDE_LABEL[dniSide]} de ${slot.label} cargado` : 'Archivo cargado');
      await loadSummary(summary.transportId);
      // Suggest the expiry from the type cadence; the user confirms or cancels it.
      const suggested = defaultExpiryFor(slot.cadence);
      if (suggested && !confirmed.expiresAt) {
        setExpiryFile(confirmed);
        setExpiryValue(suggested);
        setExpiryHint(slot.cadence);
      }
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo subir el archivo');
    }
  };

  const openPreview = async (file: ComplianceFileView) => {
    try {
      const data = await logisticaApi.getComplianceViewUrl(file.id);
      setPreview({
        url: data.url,
        contentType: data.contentType,
        name: data.originalName || file.originalName || file.typeKey,
      });
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo abrir el archivo');
    }
  };

  const saveVehicle = async () => {
    if (!transportId || !vehicleForm.plate.trim()) {
      toast.error('Ingresá la patente');
      return;
    }
    setSavingVehicle(true);
    try {
      await logisticaApi.createVehicle({
        transportId,
        plate: vehicleForm.plate,
        label: vehicleForm.label.trim() || undefined,
        kind: vehicleForm.kind,
      });
      toast.success('Vehículo creado');
      setVehicleOpen(false);
      setVehicleForm({ plate: '', label: '', kind: 'camion' });
      await loadSummary(transportId);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo crear el vehículo');
    } finally {
      setSavingVehicle(false);
    }
  };

  const deactivateVehicle = async (vehicle: VehicleView) => {
    if (!confirm(`Desactivar ${vehicle.plate}?`)) return;
    try {
      await logisticaApi.updateVehicle(vehicle.id, { active: false });
      await loadSummary(transportId);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo desactivar');
    }
  };

  const saveExpiry = async () => {
    if (!expiryFile) return;
    try {
      await logisticaApi.updateComplianceFile(expiryFile.id, {
        expiresAt: expiryValue || null,
      });
      toast.success('Vencimiento actualizado');
      setExpiryFile(null);
      await loadSummary(transportId);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo guardar el vencimiento');
    }
  };

  const openExpiry = (file: ComplianceFileView, cadence: ComplianceCadence) => {
    const current = file.expiresAt?.slice(0, 10) ?? '';
    const suggested = current ? '' : defaultExpiryFor(cadence);
    setExpiryFile(file);
    setExpiryValue(current || suggested);
    setExpiryHint(suggested ? cadence : null);
  };

  const approveFile = async (file: ComplianceFileView) => {
    try {
      await logisticaApi.approveComplianceFile(file.id);
      toast.success('Archivo aprobado');
      await loadSummary(transportId);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo aprobar el archivo');
    }
  };

  const openFromBoard = (row: ComplianceOverviewRow) => {
    setFilter('all');
    setTransportId(row.transportId);
    setOpenEmpresa(row.subject === 'TRANSPORT');
    setOpenChofer(row.subject === 'PERSON' ? row.subjectUserId : null);
    setOpenVehicle(row.subject === 'VEHICLE' ? row.vehicleId : null);
    setView('detail');
  };

  const removeFile = async (file: ComplianceFileView) => {
    if (!confirm('¿Quitar este archivo? Queda en historial.')) return;
    try {
      await logisticaApi.deleteComplianceFile(file.id);
      await loadSummary(transportId);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo quitar el archivo');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <DocumentacionHeader
        abilities={abilities}
        view={view}
        onView={setView}
        onConfigure={() => setTypesOpen(true)}
        onRefresh={() => void (view === 'board' ? loadOverview() : loadSummary(transportId))}
      />

      {view === 'board' && abilities.isOffice ? (
        <OverviewBoard rows={overviewRows} loading={overviewLoading} onOpen={openFromBoard} />
      ) : (
      <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="transport">Transporte</Label>
          <Select
            id="transport"
            value={transportId}
            onChange={(e) => setTransportId(e.target.value)}
          >
            <option value="">Elegí un transporte</option>
            {transports.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {transportId && (
        <div className="flex flex-wrap gap-2">
          {(['all', 'missing', 'expiring', 'expired', 'ok'] as StatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium',
                filter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
              ].join(' ')}
            >
              {key === 'all' ? 'Todos' : STATUS_LABEL[key]}
              {key !== 'all' && key !== 'ok' ? ` (${counts[key as 'missing' | 'expiring' | 'expired']})` : ''}
            </button>
          ))}
        </div>
      )}

      {!transportId ? (
        <p className="text-sm text-muted-foreground">Seleccioná un transporte para ver su documentación.</p>
      ) : loading ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !summary ? (
        <p className="text-sm text-muted-foreground">No hay datos de documentación.</p>
      ) : (
        <>
          <section className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Vehículos</h2>
              <Button size="sm" onClick={() => setVehicleOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Alta
              </Button>
            </div>
            {summary.vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay vehículos. El dueño o Logística pueden crearlos.</p>
            ) : (
              <ul className="space-y-2">
                {summary.vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{vehicle.plate}</span>
                      {vehicle.label ? ` · ${vehicle.label}` : ''}
                      {vehicle.kind ? ` · ${KIND_LABEL[vehicle.kind]}` : ''}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => void deactivateVehicle(vehicle)}>
                      Desactivar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Section
            title="Empresa"
            open={openEmpresa}
            onToggle={() => setOpenEmpresa((v) => !v)}
          >
            <SlotList
              slots={slots.filter((s) => s.subject === 'TRANSPORT')}
              onUpload={uploadSlot}
              onPreview={openPreview}
              onExpiry={openExpiry}
              onApprove={abilities.canApprove ? approveFile : undefined}
              onRemove={removeFile}
            />
          </Section>

          {summary.members.map((member) => (
            <Section
              key={member.userId}
              title={`${member.name || member.email} · ${member.role === 'DUENO' ? 'Dueño' : 'Chofer'}`}
              open={openChofer === member.userId}
              onToggle={() => setOpenChofer((v) => v === member.userId ? null : member.userId)}
            >
              <SlotList
                slots={slots.filter((s) => s.subject === 'PERSON' && s.subjectUserId === member.userId)}
                onUpload={uploadSlot}
                onPreview={openPreview}
                onExpiry={openExpiry}
                onApprove={abilities.canApprove ? approveFile : undefined}
                onRemove={removeFile}
              />
            </Section>
          ))}

          {summary.vehicles.map((vehicle) => (
            <Section
              key={vehicle.id}
              title={`${vehicle.plate}${vehicle.label ? ` · ${vehicle.label}` : ''}`}
              open={openVehicle === vehicle.id}
              onToggle={() => setOpenVehicle((v) => v === vehicle.id ? null : vehicle.id)}
            >
              <SlotList
                slots={slots.filter((s) => s.subject === 'VEHICLE' && s.vehicleId === vehicle.id)}
                onUpload={uploadSlot}
                onPreview={openPreview}
                onExpiry={openExpiry}
                onApprove={abilities.canApprove ? approveFile : undefined}
                onRemove={removeFile}
              />
            </Section>
          ))}
        </>
      )}
      </>
      )}

      <TypesConfigDialog
        open={typesOpen}
        onClose={() => setTypesOpen(false)}
        onSaved={() => void (view === 'board' ? loadOverview() : loadSummary(transportId))}
      />

      <Dialog open={vehicleOpen} onClose={() => setVehicleOpen(false)} title="Nuevo vehículo">
        <div className="space-y-3">
          <div>
            <Label htmlFor="plate">Patente</Label>
            <Input
              id="plate"
              value={vehicleForm.plate}
              onChange={(e) => setVehicleForm((v) => ({ ...v, plate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="label">Alias</Label>
            <Input
              id="label"
              value={vehicleForm.label}
              onChange={(e) => setVehicleForm((v) => ({ ...v, label: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="kind">Tipo</Label>
            <Select
              id="kind"
              value={vehicleForm.kind}
              onChange={(e) => setVehicleForm((v) => ({ ...v, kind: e.target.value as VehicleKind }))}
            >
              <option value="camion">Camión</option>
              <option value="batea">Batea</option>
              <option value="otro">Otro</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setVehicleOpen(false)}>Cancelar</Button>
            <Button loading={savingVehicle} onClick={() => void saveVehicle()}>Guardar</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!expiryFile} onClose={() => setExpiryFile(null)} title="Vencimiento">
        <div className="space-y-3">
          <Label htmlFor="expires">Fecha de vencimiento</Label>
          <Input
            id="expires"
            type="date"
            value={expiryValue}
            onChange={(e) => setExpiryValue(e.target.value)}
          />
          {expiryHint && (
            <p className="text-xs text-muted-foreground">
              Fecha sugerida según el vencimiento del tipo ({CADENCE_LABEL[expiryHint]}). Podés cambiarla.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExpiryFile(null)}>Cancelar</Button>
            <Button onClick={() => void saveExpiry()}>Guardar</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name ?? 'Archivo'}
        panelClassName="max-w-3xl"
      >
        {preview?.contentType === 'application/pdf' ? (
          <iframe title="PDF" src={preview.url} className="w-full h-[70vh] rounded border" />
        ) : preview ? (
          <img src={preview.url} alt={preview.name} className="max-h-[70vh] mx-auto" />
        ) : null}
      </Dialog>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-medium">{title}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </section>
  );
}

export function SlotList({
  slots,
  onUpload,
  onPreview,
  onExpiry,
  onRemove,
  onApprove,
}: {
  slots: ComplianceSlotView[];
  onUpload: (slot: ComplianceSlotView, file: File, replaceFileId?: string, dniSide?: DniSide) => Promise<void>;
  onPreview: (file: ComplianceFileView) => void;
  onExpiry: (file: ComplianceFileView, cadence: ComplianceCadence) => void;
  onRemove: (file: ComplianceFileView) => void;
  /** Present only for users allowed to approve documentation. */
  onApprove?: (file: ComplianceFileView) => void;
}) {
  if (!slots.length) {
    return <p className="text-sm text-muted-foreground">Sin ítems para este filtro.</p>;
  }
  return (
    <ul className="space-y-3">
      {slots.map((slot) => {
        const twoSided = isTwoSided(slot);
        const rowProps = {
          onPreview,
          onExpiry: (file: ComplianceFileView) => onExpiry(file, slot.cadence),
          onRemove,
          onApprove,
        };
        return (
          <li key={`${slot.typeKey}-${slot.subjectUserId ?? ''}-${slot.vehicleId ?? ''}`} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{slot.label}</span>
                <StatusBadge status={slot.status} />
                {slot.pendingReview > 0 && (
                  <Badge variant="secondary">
                    {slot.pendingReview} {slot.pendingReview === 1 ? 'pendiente' : 'pendientes'} de revisión
                  </Badge>
                )}
              </div>
              {!twoSided && <UploadInput label="Subir" onFile={(file) => void onUpload(slot, file)} />}
            </div>
            {twoSided ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">Cargá el frente y el dorso por separado. Podés ver o reemplazar cada lado.</p>
                {(['front', 'back'] as const).map((side) => (
                  <div key={side} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{SIDE_LABEL[side]}</span>
                      {!slot.files.some((file) => file.dniSide === side) && (
                        <UploadInput label={`Subir ${SIDE_LABEL[side].toLowerCase()}`} onFile={(file) => void onUpload(slot, file, undefined, side)} />
                      )}
                    </div>
                    <FileRows
                      {...rowProps}
                      files={slot.files.filter((file) => file.dniSide === side)}
                      onReplace={(file, next) => void onUpload(slot, next, file.id, side)}
                    />
                  </div>
                ))}
                {slot.files.some((file) => !file.dniSide) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Archivos anteriores sin lado identificado. Para completar el documento, cargá frente y dorso arriba.</p>
                    <FileRows {...rowProps} files={slot.files.filter((file) => !file.dniSide)} />
                  </div>
                )}
              </div>
            ) : (
              <FileRows
                {...rowProps}
                files={slot.files}
                onReplace={(file, next) => void onUpload(slot, next, file.id)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function UploadInput({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label className="inline-flex">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      <span className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-md border border-input cursor-pointer hover:bg-accent">
        <Upload className="h-3.5 w-3.5 mr-1" />
        {label}
      </span>
    </label>
  );
}

function FileRows({ files, onPreview, onExpiry, onRemove, onReplace, onApprove }: {
  files: ComplianceFileView[];
  onPreview: (file: ComplianceFileView) => void;
  onExpiry: (file: ComplianceFileView) => void;
  onRemove: (file: ComplianceFileView) => void;
  onReplace?: (file: ComplianceFileView, next: File) => void;
  onApprove?: (file: ComplianceFileView) => void;
}) {
  if (files.length === 0) return <p className="text-xs text-muted-foreground mt-2">Sin archivo.</p>;
  return (
    <ul className="mt-2 space-y-1">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <button type="button" className="text-left hover:underline" onClick={() => onPreview(file)}>
            {file.originalName || file.contentType}
            {file.expiresAt ? ` · vence ${file.expiresAt.slice(0, 10)}` : ''}
          </button>
          <span className="flex items-center gap-1">
            <Badge variant="outline">{STATUS_LABEL[file.status]}</Badge>
            <ReviewBadge file={file} />
            {onApprove && file.confirmedAt && file.reviewStatus !== 'APPROVED' && (
              <Button variant="ghost" size="sm" onClick={() => onApprove(file)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Aprobar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onExpiry(file)}>Vence</Button>
            {onReplace && <UploadInput label="Reemplazar" onFile={(next) => onReplace(file, next)} />}
            <Button variant="ghost" size="icon" aria-label="Quitar archivo" onClick={() => onRemove(file)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}
