import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { conciliacionesApi } from '@/api/conciliaciones';
import { useAppSelector } from '@/store';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { AddPendingDialog } from '@/components/conciliaciones/AddPendingDialog';
import { NotifyDialog } from '@/components/conciliaciones/NotifyDialog';
import { UpdateSystemDialog } from '@/components/conciliaciones/UpdateSystemDialog';
import { WorkspacePanel } from '@/components/conciliaciones/WorkspacePanel';
import { RunDetailSidebar } from '@/components/conciliaciones/RunDetailSidebar';
import { ResumenPanel } from '@/components/conciliaciones/ResumenPanel';
import { ExclusionesPanel } from '@/components/conciliaciones/ExclusionesPanel';
import { IssuesPanel } from '@/components/conciliaciones/IssuesPanel';
import { PermissionsPanel } from '@/components/conciliaciones/PermissionsPanel';
import { LibroBancoPanel } from '@/components/conciliaciones/LibroBancoPanel';
import type { RunDetail } from '@/types/conciliaciones.types';
import type { RunDetailSection } from '@/components/conciliaciones/RunDetailSidebar';

const BANK_OPTIONS = ['Banco Nación', 'Banco Galicia', 'Banco Santander', 'Banco Provincia', 'Banco Macro', 'Banco Supervielle', 'Mercado Pago'];
const COMPANY_OPTIONS = ['Lince', 'Lercara', 'Zumbi'];

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAppSelector((s) => s.auth.user);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [section, setSection] = useState<RunDetailSection>('resumen');
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingSystemLineId, setPendingSystemLineId] = useState('');
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateSystemDialogOpen, setUpdateSystemDialogOpen] = useState(false);

  const isClosed = detail?.status === 'CLOSED';
  const isCreator = !!(detail?.createdById && user?.id && detail.createdById === user.id);
  const canEdit = isCreator || (detail?.members?.some((m) => m.userId === user?.id && m.role === 'EDITOR') ?? false);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const data = await conciliacionesApi.getRun(id);
      setDetail(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`No se pudo cargar la conciliación: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setDetail(null);
    setIsLoading(true);
    void fetchDetail();
  }, [id]);

  const handleExport = async () => {
    if (!id) return;
    try {
      const blob = await conciliacionesApi.exportRun(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conciliacion-${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Archivo descargado');
    } catch {
      toast.error('Error al exportar');
    }
  };

  const handleAddPending = async (area: string, note: string) => {
    if (!id) return;
    await conciliacionesApi.createPending(id, { area, systemLineId: pendingSystemLineId, note: note || undefined });
    void fetchDetail();
  };

  const handleResolvePending = async (pendingId: string) => {
    if (!id) return;
    const note = prompt('Nota de resolución:');
    if (!note) return;
    try {
      await conciliacionesApi.resolvePending(id, pendingId, note);
      void fetchDetail();
      toast.success('Pendiente resuelto');
    } catch { toast.error('Error al resolver'); }
  };

  const handleNotify = async (areas: string[], customMessage: string) => {
    if (!id) return;
    await conciliacionesApi.notifyPending(id, { areas, customMessage: customMessage || undefined });
  };

  const handleWorkspaceSave = async (items: Array<{ systemLineId: string; area: string; status: 'OVERDUE' | 'DEFERRED' }>) => {
    if (!id) return;
    for (const item of items) {
      await conciliacionesApi.createPending(id, { area: item.area, systemLineId: item.systemLineId, note: `Estado: ${item.status === 'OVERDUE' ? 'Vencido' : 'Diferido'}` });
    }
    void fetchDetail();
  };

  const handleToggleStatus = async () => {
    if (!id || !detail) return;
    const next = detail.status === 'CLOSED' ? 'OPEN' : 'CLOSED';
    setUpdatingStatus(true);
    try {
      await conciliacionesApi.updateRun(id, { status: next });
      setDetail((d) => d ? { ...d, status: next } : d);
      toast.success(next === 'CLOSED' ? 'Conciliación cerrada' : 'Conciliación reabierta');
    } catch { toast.error('Error al cambiar estado'); }
    finally { setUpdatingStatus(false); }
  };

  const handleBankChange = async (bank: string) => {
    if (!id || !detail) return;
    try {
      await conciliacionesApi.updateRun(id, { bankName: bank || null });
      void fetchDetail();
      toast.success('Banco actualizado');
    } catch { toast.error('Error al actualizar banco'); }
  };

  const handleCompanyChange = async (comp: string) => {
    if (!id || !detail) return;
    try {
      await conciliacionesApi.updateRun(id, { company: comp || null });
      void fetchDetail();
      toast.success('Empresa actualizada');
    } catch { toast.error('Error al actualizar empresa'); }
  };

  const handleWorkspaceFinalize = async () => {
    if (!id || !detail) return;
    const pendingItems = detail.pendingItems || [];
    const pendingByArea = pendingItems.filter((p) => p.status !== 'RESOLVED').reduce((acc, p) => { acc[p.area] = (acc[p.area] || 0) + 1; return acc; }, {} as Record<string, number>);
    const areasWithPending = Object.keys(pendingByArea).filter((a) => ['Dirección', 'Tesorería'].includes(a));
    if (areasWithPending.length === 0) { toast.error('No hay movimientos pendientes para notificar'); return; }
    try {
      await conciliacionesApi.notifyPending(id, { areas: areasWithPending });
      toast.success(`Notificaciones enviadas a ${areasWithPending.length} área(s)`);
      setSection('resumen');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error al enviar notificaciones'); }
  };

  const pendingAreaBySystemLineId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of detail?.pendingItems ?? []) {
      if (p.status !== 'RESOLVED' && p.systemLineId && p.area) m.set(p.systemLineId, p.area);
    }
    return m;
  }, [detail?.pendingItems]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">No se pudo cargar la conciliación.</p>
        <button
          onClick={() => { setIsLoading(true); void fetchDetail(); }}
          className="text-sm text-primary underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const extractLinesActive = detail.extractLines.filter((l) => !l.excluded);
  const extractById = new Map(extractLinesActive.map((l) => [l.id, l]));
  const systemById = new Map(detail.systemLines.map((l) => [l.id, l]));
  const pendingItems = detail.pendingItems || [];
  const pendingByArea = pendingItems.filter((p) => p.status !== 'RESOLVED').reduce((acc, p) => { acc[p.area] = (acc[p.area] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pendingCount = pendingItems.filter((p) => p.status !== 'RESOLVED').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{detail.title || 'Conciliación'}</h1>
            <Badge className={detail.status === 'CLOSED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'}>
              {detail.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
            </Badge>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
            <span>{new Date(detail.createdAt).toLocaleDateString()}</span>
            <span>—</span>
            {!isClosed && canEdit ? (
              <>
                <Label className="text-muted-foreground font-normal">Empresa:</Label>
                <Select value={COMPANY_OPTIONS.includes(detail.company || '') ? (detail.company ?? '') : ''} onChange={(e) => void handleCompanyChange(e.target.value)} className="w-36 h-8 text-sm">
                  <option value="">Sin empresa</option>
                  {COMPANY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Label className="text-muted-foreground font-normal">Banco:</Label>
                <Select value={BANK_OPTIONS.includes(detail.bankName || '') ? (detail.bankName ?? '') : ''} onChange={(e) => void handleBankChange(e.target.value)} className="w-48 h-8 text-sm">
                  <option value="">Sin definir</option>
                  {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </>
            ) : (
              <>
                {detail.company && <span className="font-medium text-foreground">{detail.company}</span>}
                {detail.company && <span>·</span>}
                <span>{detail.bankName || 'Sin banco'}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {canEdit && !isClosed && (
            <Button onClick={handleToggleStatus} disabled={updatingStatus}>
              {updatingStatus ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cerrando...</> : 'Cerrar conciliación'}
            </Button>
          )}
          {isClosed && isCreator && (
            <Button onClick={handleToggleStatus} disabled={updatingStatus}>
              {updatingStatus ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reabriendo...</> : 'Reabrir conciliación'}
            </Button>
          )}
          {!isClosed && pendingCount > 0 && (
            <Button variant="outline" onClick={() => setNotifyDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />Notificar Pendientes
            </Button>
          )}
          {!isClosed && (
            <Button variant="outline" onClick={() => setUpdateSystemDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Actualizar Excel sistema
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />Descargar Excel
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-0 rounded-lg border bg-card overflow-hidden min-h-[calc(100vh-12rem)]">
        <RunDetailSidebar active={section} onSelect={setSection} issuesCount={detail.issues?.length ?? 0} showPermisos={isCreator} />
        <div className="flex-1 overflow-auto p-4">
          {section === 'resumen' && (
            <ResumenPanel detail={detail} pendingItems={pendingItems} systemById={systemById} extractById={extractById} isClosed={!!isClosed} canEdit={canEdit} onResolvePending={handleResolvePending} onOpenAddPending={(sysId) => { setPendingSystemLineId(sysId); setPendingDialogOpen(true); }} />
          )}
          {section === 'libro-banco' && (
            <LibroBancoPanel
              systemLines={detail.systemLines}
              matches={detail.matches}
              unmatchedSystem={detail.unmatchedSystem}
              extractById={extractById}
            />
          )}
          {section === 'workspace' && !isClosed && (
            <WorkspacePanel
              matches={detail.matches} unmatchedSystem={detail.unmatchedSystem} unmatchedExtract={detail.unmatchedExtract}
              systemLines={detail.systemLines} extractLines={extractLinesActive} extractById={extractById} systemById={systemById}
              excludeConcepts={detail.excludeConcepts ?? []} pendingAreaBySystemLineId={pendingAreaBySystemLineId}
              onSave={canEdit ? handleWorkspaceSave : undefined} onFinalize={canEdit ? handleWorkspaceFinalize : undefined}
              onChangeMatchSuccess={fetchDetail} runId={canEdit ? id : undefined}
            />
          )}
          {section === 'workspace' && isClosed && (
            <p className="text-muted-foreground py-8 text-center">La conciliación está cerrada. Solo lectura.</p>
          )}
          {section === 'exclusiones' && (
            <ExclusionesPanel
              excludeConcepts={detail.excludeConcepts ?? []} extractLines={detail.extractLines}
              canEdit={canEdit} isClosed={!!isClosed} runId={id}
              onRemoveExcludedConcept={canEdit && !isClosed && id ? async (concept) => { const updated = await conciliacionesApi.removeExcludedConcept(id, concept); setDetail(updated); toast.success('Exclusión quitada'); } : undefined}
              onExcludeConcepts={canEdit && !isClosed && id ? async (concepts) => { await conciliacionesApi.excludeConcepts(id, concepts); await fetchDetail(); toast.success(concepts.length === 1 ? 'Concepto excluido' : `${concepts.length} conceptos excluidos`); } : undefined}
              onExcludeByCategory={canEdit && !isClosed && id ? async (categoryId) => { await conciliacionesApi.excludeByCategory(id, categoryId); await fetchDetail(); toast.success('Conceptos de la categoría excluidos'); } : undefined}
              onSuccess={fetchDetail}
            />
          )}
          {section === 'issues' && (
            <IssuesPanel runId={id!} issues={detail.issues ?? []} isOwner={isCreator} onRefresh={fetchDetail} />
          )}
          {section === 'permisos' && isCreator && (
            <PermissionsPanel detail={detail} onRefresh={fetchDetail} />
          )}
        </div>
      </div>

      <AddPendingDialog open={pendingDialogOpen} onClose={() => setPendingDialogOpen(false)} systemLineId={pendingSystemLineId} onSubmit={handleAddPending} />
      <NotifyDialog open={notifyDialogOpen} onClose={() => setNotifyDialogOpen(false)} pendingByArea={pendingByArea} onSubmit={handleNotify} />
      {id && <UpdateSystemDialog open={updateSystemDialogOpen} onClose={() => setUpdateSystemDialogOpen(false)} runId={id} onSuccess={fetchDetail} />}
    </div>
  );
}
