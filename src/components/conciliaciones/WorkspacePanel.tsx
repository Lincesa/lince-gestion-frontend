import { useState, useMemo, useEffect, Fragment } from 'react';
import { Check, Send, Link2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { ChangeMatchDialog } from './ChangeMatchDialog';
import { hasCarryoverContext, type UnmatchedSystem, type SystemLine, type ExtractLine, type Match, type PendingItem } from '@/types/conciliaciones.types';
import { formatCalendarDate } from '@/utils/conciliaciones';

interface WorkspacePanelProps {
  matches: Match[];
  unmatchedSystem: UnmatchedSystem[];
  unmatchedExtract: { id?: string; extractLineId: string; justification?: string | null }[];
  systemLines: SystemLine[];
  extractLines: ExtractLine[];
  systemById: Map<string, SystemLine>;
  extractById: Map<string, ExtractLine>;
  excludeConcepts?: string[];
  onSave?: (items: Array<{ systemLineId: string; area: string; status: 'OVERDUE' | 'DEFERRED'; note: string }>) => Promise<void>;
  onFinalize?: () => void;
  onChangeMatchSuccess?: () => void;
  onJustifySystem?: (systemLineId: string, justification: string) => Promise<void>;
  onJustifyExtract?: (extractLineId: string, justification: string) => Promise<void>;
  onConvertExtractToPending?: (extractLineId: string, area: string, note: string) => Promise<void>;
  runId?: string;
  pendingAreaBySystemLineId?: Map<string, string>;
  pendingItems?: PendingItem[];
}

const AREAS = ['Dirección', 'Tesorería'];
const TAB_SISTEMA = 'sistema';
const TAB_EXTRACTO = 'extracto';

export function WorkspacePanel({ matches, unmatchedSystem, unmatchedExtract, systemLines, extractLines, systemById, extractById, onSave, onFinalize, onChangeMatchSuccess, onJustifySystem, onJustifyExtract, onConvertExtractToPending, runId, pendingAreaBySystemLineId, pendingItems = [] }: WorkspacePanelProps) {
  const [workItems, setWorkItems] = useState<Map<string, { area: string; status: 'OVERDUE' | 'DEFERRED'; note: string }>>(new Map());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkArea, setBulkArea] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_SISTEMA);
  const [systemJustifications, setSystemJustifications] = useState<Map<string, string>>(new Map());
  const [extractWork, setExtractWork] = useState<Map<string, { area: string; note: string; justification: string }>>(new Map());
  const [changeMatchSelection, setChangeMatchSelection] = useState<{
    systemIds: string[];
    extractIds: string[];
    groupKey: string | null;
  } | null>(null);
  const [expandedSystemId, setExpandedSystemId] = useState<string | null>(null);
  const [expandedExtractId, setExpandedExtractId] = useState<string | null>(null);

  useEffect(() => {
    setWorkItems((prev) => {
      const next = new Map(prev);
      let changed = false;
      const pendingArea = pendingAreaBySystemLineId ?? new Map<string, string>();
      for (const u of unmatchedSystem) {
        const id = u.systemLineId;
        const status = (u.status === 'OVERDUE' || u.status === 'DEFERRED') ? u.status : 'DEFERRED';
        if (!next.has(id)) { next.set(id, { area: pendingArea.get(id) ?? '', status, note: '' }); changed = true; }
        else {
          const current = next.get(id)!;
          const areaFromBackend = pendingArea.get(id) ?? '';
          if (current.area === '' && areaFromBackend !== '') { next.set(id, { ...current, area: areaFromBackend }); changed = true; }
        }
      }
      return changed ? next : prev;
    });
    setSystemJustifications((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const u of unmatchedSystem) {
        if (!next.has(u.systemLineId)) {
          next.set(u.systemLineId, u.justification ?? '');
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setExtractWork((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const row of unmatchedExtract) {
        if (!next.has(row.extractLineId)) {
          next.set(row.extractLineId, { area: '', note: '', justification: row.justification ?? '' });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [unmatchedSystem, unmatchedExtract, pendingAreaBySystemLineId]);

  const systemToExtracts = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const match of matches) { const list = m.get(match.systemLineId) || []; if (!list.includes(match.extractLineId)) list.push(match.extractLineId); m.set(match.systemLineId, list); }
    return m;
  }, [matches]);

  const extractToSystems = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const match of matches) { const list = m.get(match.extractLineId) || []; if (!list.includes(match.systemLineId)) list.push(match.systemLineId); m.set(match.extractLineId, list); }
    return m;
  }, [matches]);

  const matchGroupKey = (match: Match) => match.matchGroupId ? `group:${match.matchGroupId}` : `system:${match.systemLineId}`;

  const openChangeMatchFromSystem = (systemId: string) => {
    const directMatches = matches.filter((match) => match.systemLineId === systemId);
    const groupKey = directMatches[0] ? matchGroupKey(directMatches[0]) : null;
    const groupMatches = groupKey ? matches.filter((match) => matchGroupKey(match) === groupKey) : [];
    setChangeMatchSelection({
      systemIds: groupMatches.length > 0 ? [...new Set(groupMatches.map((match) => match.systemLineId))] : [systemId],
      extractIds: groupMatches.length > 0 ? [...new Set(groupMatches.map((match) => match.extractLineId))] : [],
      groupKey,
    });
  };

  const openChangeMatchFromExtract = (extractId: string) => {
    const directMatches = matches.filter((match) => match.extractLineId === extractId);
    const groupKey = directMatches[0] ? matchGroupKey(directMatches[0]) : null;
    const groupMatches = groupKey ? matches.filter((match) => matchGroupKey(match) === groupKey) : [];
    setChangeMatchSelection({
      systemIds: groupMatches.length > 0 ? [...new Set(groupMatches.map((match) => match.systemLineId))] : [],
      extractIds: groupMatches.length > 0 ? [...new Set(groupMatches.map((match) => match.extractLineId))] : [extractId],
      groupKey,
    });
  };

  const blockedSystemIdsForDialog = useMemo(() => {
    if (!changeMatchSelection) return new Set<string>();
    const blocked = new Set<string>();
    for (const match of matches) {
      if (matchGroupKey(match) !== changeMatchSelection.groupKey) {
        blocked.add(match.systemLineId);
      }
    }
    return blocked;
  }, [matches, changeMatchSelection]);

  const blockedExtractIdsForDialog = useMemo(() => {
    if (!changeMatchSelection) return new Set<string>();
    const blocked = new Set<string>();
    for (const match of matches) {
      if (matchGroupKey(match) !== changeMatchSelection.groupKey) {
        blocked.add(match.extractLineId);
      }
    }
    return blocked;
  }, [matches, changeMatchSelection]);

  const allIncorrect = [
    ...unmatchedSystem.map((u) => ({ id: u.systemLineId, type: u.status as 'OVERDUE' | 'DEFERRED', systemLine: systemById.get(u.systemLineId), status: u.status as 'OVERDUE' | 'DEFERRED' })),
  ].sort((a, b) => (a.status === 'OVERDUE' && b.status !== 'OVERDUE' ? -1 : a.status !== 'OVERDUE' && b.status === 'OVERDUE' ? 1 : 0));

  const handleToggleItem = (id: string) => { const s = new Set(selectedItems); if (s.has(id)) s.delete(id); else s.add(id); setSelectedItems(s); };
  const handleToggleAll = () => setSelectedItems(selectedItems.size === allIncorrect.length ? new Set() : new Set(allIncorrect.map((i) => i.id)));

  const handleAreaChange = (id: string, area: string) => {
    const newItems = new Map(workItems);
    const item = allIncorrect.find((i) => i.id === id);
    if (item) newItems.set(id, { area, status: workItems.get(id)?.status || item.status, note: workItems.get(id)?.note || '' });
    setWorkItems(newItems);
  };

  const handleStatusChange = (id: string, status: 'OVERDUE' | 'DEFERRED') => {
    const newItems = new Map(workItems);
    newItems.set(id, { area: workItems.get(id)?.area || '', status, note: workItems.get(id)?.note || '' });
    setWorkItems(newItems);
  };

  const handleNoteChange = (id: string, note: string) => {
    const newItems = new Map(workItems);
    const current = workItems.get(id);
    if (!current) return;
    newItems.set(id, { ...current, note });
    setWorkItems(newItems);
  };

  const handleBulkAssign = () => {
    if (!bulkArea || selectedItems.size === 0) { toast.error('Selecciona un área y al menos un movimiento'); return; }
    const newItems = new Map(workItems);
    selectedItems.forEach((id) => {
      const item = allIncorrect.find((i) => i.id === id);
      if (item) newItems.set(id, { area: bulkArea, status: workItems.get(id)?.status || item.status, note: workItems.get(id)?.note || '' });
    });
    setWorkItems(newItems);
    setSelectedItems(new Set());
    toast.success(`${selectedItems.size} movimiento(s) asignado(s) a ${bulkArea}`);
  };

  const handleSave = async () => {
    const itemsToSave = Array.from(workItems.entries())
      .filter(([, d]) => d.area)
      .map(([systemLineId, data]) => ({ systemLineId, area: data.area, status: data.status, note: data.note.trim() }));
    if (itemsToSave.length === 0) { toast.error('No hay movimientos con área asignada'); return; }
    const missingNote = itemsToSave.filter((item) => !item.note);
    if (missingNote.length > 0) {
      toast.error('Cada pendiente necesita una justificación/nota');
      return;
    }
    if (!onSave) return;
    setIsSaving(true);
    try { await onSave(itemsToSave); toast.success('Cambios guardados exitosamente'); }
    catch { toast.error('Error al guardar'); }
    finally { setIsSaving(false); }
  };

  const pendingCount = Array.from(workItems.values()).filter((i) => i.area).length;
  const overdueCount = allIncorrect.filter((i) => (workItems.get(i.id)?.status || i.status) === 'OVERDUE').length;
  const deferredCount = allIncorrect.filter((i) => (workItems.get(i.id)?.status || i.status) === 'DEFERRED').length;
  const carriedPendingBySystemLineId = useMemo(() => new Map(
    pendingItems
      .filter((pending) => pending.status !== 'RESOLVED' && pending.systemLineId && hasCarryoverContext(pending))
      .map((pending) => [pending.systemLineId!, pending]),
  ), [pendingItems]);

  return (
    <>
      <Card className="border-l-4 border-l-indigo-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-indigo-700 dark:text-indigo-400">Espacio de Trabajo</CardTitle>
              <CardDescription>Movimientos sin match: asigná áreas a los del sistema y revisá los solo en extracto</CardDescription>
            </div>
            {onSave != null && onFinalize != null && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSave} disabled={isSaving || pendingCount === 0}>
                  <Check className="mr-2 h-4 w-4" />Guardar Cambios ({pendingCount})
                </Button>
                <Button onClick={onFinalize} disabled={pendingCount === 0}>
                  <Send className="mr-2 h-4 w-4" />Finalizar y Notificar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 p-4 bg-muted/50 dark:bg-muted/30 rounded-lg">
            <div className="flex-1"><p className="text-sm text-muted-foreground">Total sin match</p><p className="text-2xl font-bold">{allIncorrect.length + unmatchedExtract.length}</p></div>
            <div className="flex-1"><p className="text-sm text-muted-foreground">Vencidos</p><p className="text-2xl font-bold text-red-600 dark:text-red-200">{overdueCount}</p></div>
            <div className="flex-1"><p className="text-sm text-muted-foreground">Diferidos</p><p className="text-2xl font-bold text-yellow-600 dark:text-yellow-200">{deferredCount}</p></div>
            <div className="flex-1"><p className="text-sm text-muted-foreground">Solo extracto</p><p className="text-2xl font-bold text-blue-600 dark:text-blue-200">{unmatchedExtract.length}</p></div>
            <div className="flex-1"><p className="text-sm text-muted-foreground">Con área</p><p className="text-2xl font-bold text-green-600 dark:text-green-200">{pendingCount}</p></div>
          </div>

          <CollapsibleSection title="Vista por archivo (Sistema / Extracto)" defaultOpen={true} maxHeight="50vh">
            <div className="p-2 space-y-2">
              <div className="flex gap-2">
                <Button variant={activeTab === TAB_SISTEMA ? 'primary' : 'outline'} size="sm" onClick={() => setActiveTab(TAB_SISTEMA)}><FileSpreadsheet className="mr-1 h-4 w-4" />Sistema</Button>
                <Button variant={activeTab === TAB_EXTRACTO ? 'primary' : 'outline'} size="sm" onClick={() => setActiveTab(TAB_EXTRACTO)}><Link2 className="mr-1 h-4 w-4" />Extracto</Button>
              </div>
              <p className="text-xs text-muted-foreground">Verde = conciliado, Rojo = vencido, Amarillo = diferido, Azul = solo extracto. Click en fila para ver match.</p>
              {activeTab === TAB_SISTEMA && (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead><TableHead>Emisión</TableHead><TableHead>Venc.</TableHead>
                        <TableHead>Importe</TableHead><TableHead>Estado</TableHead>
                        {runId && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systemLines.map((sys) => {
                        const isMatched = systemToExtracts.has(sys.id);
                        const un = unmatchedSystem.find((u) => u.systemLineId === sys.id);
                        const rowClass = isMatched ? 'bg-green-100 dark:bg-green-900/50' : un?.status === 'OVERDUE' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-yellow-100 dark:bg-yellow-900/50';
                        const extractIds = systemToExtracts.get(sys.id) || [];
                        const isExpanded = expandedSystemId === sys.id;
                        return (
                          <Fragment key={sys.id}>
                            <TableRow className={`${rowClass} cursor-pointer`} onClick={() => setExpandedSystemId(isExpanded ? null : sys.id)}>
                              <TableCell className="max-w-[200px] truncate">{sys.description || '-'}</TableCell>
                              <TableCell>{formatCalendarDate(sys.issueDate)}</TableCell>
                              <TableCell>{formatCalendarDate(sys.dueDate)}</TableCell>
                              <TableCell>${sys.amount.toFixed(2)}</TableCell>
                              <TableCell>{isMatched ? 'Correcto' : un?.status === 'OVERDUE' ? 'Vencido' : 'Diferido'}</TableCell>
                              {runId && (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Button variant="outline" size="sm" onClick={() => openChangeMatchFromSystem(sys.id)}>
                                    {isMatched ? 'Cambiar match' : 'Matchear'}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                            {isExpanded && extractIds.length > 0 && (
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={runId ? 6 : 5} className="py-2">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Match con extracto:</p>
                                  <ul className="space-y-1 text-sm">
                                    {extractIds.map((eid) => { const e = extractById.get(eid); return e ? <li key={eid}>{formatCalendarDate(e.date)} — {e.concept || '-'} — ${e.amount.toFixed(2)}</li> : null; })}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {activeTab === TAB_EXTRACTO && (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Concepto</TableHead><TableHead>Importe</TableHead><TableHead>Estado</TableHead>{runId && <TableHead></TableHead>}</TableRow></TableHeader>
                    <TableBody>
                      {extractLines.map((ext) => {
                        const isMatched = extractToSystems.has(ext.id);
                        const rowClass = isMatched ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50';
                        const systemIds = extractToSystems.get(ext.id) || [];
                        const isExpanded = expandedExtractId === ext.id;
                        return (
                          <Fragment key={ext.id}>
                            <TableRow className={`${rowClass} cursor-pointer`} onClick={() => setExpandedExtractId(isExpanded ? null : ext.id)}>
                              <TableCell>{formatCalendarDate(ext.date)}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{ext.concept || '-'}</TableCell>
                              <TableCell>${ext.amount.toFixed(2)}</TableCell>
                              <TableCell>{isMatched ? 'Correcto' : 'Solo extracto'}</TableCell>
                              {runId && (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Button variant="outline" size="sm" onClick={() => openChangeMatchFromExtract(ext.id)}>
                                    {isMatched ? 'Cambiar match' : 'Matchear'}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                            {isExpanded && systemIds.length > 0 && (
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={runId ? 5 : 4} className="py-2">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Match con sistema:</p>
                                  <ul className="space-y-1 text-sm">
                                    {systemIds.map((sid) => { const s = systemById.get(sid); return s ? <li key={sid}>{s.description || '-'} — ${s.amount.toFixed(2)}</li> : null; })}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {onSave != null && selectedItems.size > 0 && (
            <div className="flex gap-2 items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-sm font-medium">{selectedItems.size} seleccionado(s)</span>
              <Select value={bulkArea} onChange={(e) => setBulkArea(e.target.value)} className="w-48">
                <option value="">Asignar área...</option>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
              <Button size="sm" onClick={handleBulkAssign}>Asignar en Lote</Button>
            </div>
          )}

          <CollapsibleSection title={`Sistema sin match (${allIncorrect.length}) — justificá o convertí a pendiente`} defaultOpen={allIncorrect.length > 0} maxHeight="50vh">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input type="checkbox" checked={selectedItems.size === allIncorrect.length && allIncorrect.length > 0} onChange={handleToggleAll} disabled={!onSave} className="h-4 w-4 rounded border-input" />
                  </TableHead>
                  <TableHead>Descripción</TableHead><TableHead>Fecha Emisión</TableHead><TableHead>Fecha Venc.</TableHead>
                  <TableHead>Importe</TableHead><TableHead>Estado</TableHead><TableHead>Área</TableHead><TableHead>Nota pendiente</TableHead><TableHead>Justificación</TableHead><TableHead>Contexto</TableHead>
                  {runId && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allIncorrect.map((item) => {
                  const sys = item.systemLine;
                  if (!sys) return null;
                  const workData = workItems.get(item.id);
                  const currentStatus = workData?.status ?? item.status;
                  const carriedPending = carriedPendingBySystemLineId.get(item.id);
                  const unmatchedMeta = unmatchedSystem.find((u) => u.systemLineId === item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleToggleItem(item.id)} disabled={!onSave} className="h-4 w-4 rounded border-input" />
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">{sys.description || '-'}</TableCell>
                      <TableCell>{formatCalendarDate(sys.issueDate)}</TableCell>
                      <TableCell>{formatCalendarDate(sys.dueDate)}</TableCell>
                      <TableCell>${sys.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Select value={currentStatus} onChange={(e) => handleStatusChange(item.id, e.target.value as 'OVERDUE' | 'DEFERRED')} className="w-28" disabled={!onSave}>
                          <option value="OVERDUE">Vencido</option>
                          <option value="DEFERRED">Diferido</option>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={workData?.area || ''} onChange={(e) => handleAreaChange(item.id, e.target.value)} className="w-32" disabled={!onSave}>
                          <option value="">Sin asignar</option>
                          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <input
                          className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
                          value={workData?.note || ''}
                          disabled={!onSave}
                          placeholder="Nota obligatoria"
                          onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <input
                            className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
                            value={systemJustifications.get(item.id) ?? unmatchedMeta?.justification ?? ''}
                            disabled={!onJustifySystem}
                            placeholder="Por qué no matcheó"
                            onChange={(e) => {
                              const next = new Map(systemJustifications);
                              next.set(item.id, e.target.value);
                              setSystemJustifications(next);
                            }}
                          />
                          {onJustifySystem && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const text = (systemJustifications.get(item.id) ?? '').trim();
                                if (!text) { toast.error('Escribí una justificación'); return; }
                                try {
                                  await onJustifySystem(item.id, text);
                                  toast.success('Justificación guardada');
                                } catch { toast.error('No se pudo guardar'); }
                              }}
                            >
                              Guardar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-amber-700 dark:text-amber-300">
                        {carriedPending ? (
                          <span title={carriedPending.sourceRunId ?? carriedPending.originPendingItemId ?? undefined}>
                            Arrastrado{carriedPending.carriedAt ? ` · ${formatCalendarDate(carriedPending.carriedAt)}` : ''}
                          </span>
                        ) : (unmatchedMeta?.justification ? 'Justificado' : '-')}
                      </TableCell>
                      {runId && (
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => openChangeMatchFromSystem(item.id)}>Matchear</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CollapsibleSection>

          {allIncorrect.length === 0 && unmatchedExtract.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No hay movimientos sin match para gestionar</div>
          )}

          {unmatchedExtract.length > 0 && (
            <CollapsibleSection title={`Solo en extracto (${unmatchedExtract.length}) — justificá o pasá a pendiente`} defaultOpen={true} maxHeight="50vh">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Concepto</TableHead><TableHead>Importe</TableHead>
                    <TableHead>Justificación</TableHead><TableHead>Área</TableHead><TableHead>Nota pendiente</TableHead>
                    {runId && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedExtract.map((row) => {
                    const ext = extractById.get(row.extractLineId);
                    if (!ext) return null;
                    const work = extractWork.get(row.extractLineId) ?? { area: '', note: '', justification: row.justification ?? '' };
                    return (
                      <TableRow key={row.extractLineId} className="bg-blue-50 dark:bg-blue-900/30">
                        <TableCell>{formatCalendarDate(ext.date)}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{ext.concept || '-'}</TableCell>
                        <TableCell>${ext.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 items-center">
                            <input
                              className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
                              value={work.justification}
                              disabled={!onJustifyExtract}
                              placeholder="Por qué no matcheó"
                              onChange={(e) => {
                                const next = new Map(extractWork);
                                next.set(row.extractLineId, { ...work, justification: e.target.value });
                                setExtractWork(next);
                              }}
                            />
                            {onJustifyExtract && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const text = work.justification.trim();
                                  if (!text) { toast.error('Escribí una justificación'); return; }
                                  try {
                                    await onJustifyExtract(row.extractLineId, text);
                                    toast.success('Justificación guardada');
                                  } catch { toast.error('No se pudo guardar'); }
                                }}
                              >
                                Guardar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={work.area}
                            disabled={!onConvertExtractToPending}
                            onChange={(e) => {
                              const next = new Map(extractWork);
                              next.set(row.extractLineId, { ...work, area: e.target.value });
                              setExtractWork(next);
                            }}
                            className="w-32"
                          >
                            <option value="">Sin asignar</option>
                            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <input
                            className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
                            value={work.note}
                            disabled={!onConvertExtractToPending}
                            placeholder="Nota obligatoria"
                            onChange={(e) => {
                              const next = new Map(extractWork);
                              next.set(row.extractLineId, { ...work, note: e.target.value });
                              setExtractWork(next);
                            }}
                          />
                        </TableCell>
                        {runId && (
                          <TableCell className="space-x-1 whitespace-nowrap">
                            <Button variant="outline" size="sm" onClick={() => openChangeMatchFromExtract(row.extractLineId)}>Matchear</Button>
                            {onConvertExtractToPending && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (!work.area) { toast.error('Asigná un área'); return; }
                                  if (!work.note.trim()) { toast.error('La nota es obligatoria'); return; }
                                  try {
                                    await onConvertExtractToPending(row.extractLineId, work.area, work.note.trim());
                                    toast.success('Convertido a pendiente');
                                  } catch { toast.error('No se pudo convertir'); }
                                }}
                              >
                                A pendiente
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CollapsibleSection>
          )}
        </CardContent>
      </Card>

      {runId && changeMatchSelection && (
        <ChangeMatchDialog
          open={!!changeMatchSelection}
          onClose={() => setChangeMatchSelection(null)}
          runId={runId}
          systemLines={systemLines}
          extractLines={extractLines}
          currentSystemIds={changeMatchSelection.systemIds}
          currentExtractIds={changeMatchSelection.extractIds}
          blockedSystemIds={blockedSystemIdsForDialog}
          blockedExtractIds={blockedExtractIdsForDialog}
          onSuccess={() => { onChangeMatchSuccess?.(); setChangeMatchSelection(null); }}
        />
      )}
    </>
  );
}
