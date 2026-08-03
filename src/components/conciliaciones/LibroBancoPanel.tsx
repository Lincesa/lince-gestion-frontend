import { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { SystemLine, Match, UnmatchedSystem, ExtractLine } from '@/types/conciliaciones.types';
import { formatCalendarDate } from '@/utils/conciliaciones';

interface LibroBancoPanelProps {
  systemLines: SystemLine[];
  matches: Match[];
  unmatchedSystem: UnmatchedSystem[];
  extractById: Map<string, ExtractLine>;
}

type LineStatus = 'matched' | 'overdue' | 'deferred';

export function LibroBancoPanel({ systemLines, matches, unmatchedSystem, extractById }: LibroBancoPanelProps) {
  const [search, setSearch] = useState('');

  const matchedSystemIds = useMemo(() => new Set(matches.map((m) => m.systemLineId)), [matches]);
  const overdueIds = useMemo(
    () => new Set(unmatchedSystem.filter((u) => u.status === 'OVERDUE').map((u) => u.systemLineId)),
    [unmatchedSystem],
  );

  const systemToExtract = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const match of matches) {
      const list = m.get(match.systemLineId) ?? [];
      list.push(match.extractLineId);
      m.set(match.systemLineId, list);
    }
    return m;
  }, [matches]);

  const enriched = useMemo(() => {
    return systemLines.map((line) => {
      let status: LineStatus;
      if (matchedSystemIds.has(line.id)) status = 'matched';
      else if (overdueIds.has(line.id)) status = 'overdue';
      else status = 'deferred';
      const extractIds = systemToExtract.get(line.id) ?? [];
      const extractConcepts = extractIds.map((id) => extractById.get(id)?.concept ?? '').filter(Boolean).join(', ');
      return { ...line, status, extractConcepts };
    });
  }, [systemLines, matchedSystemIds, overdueIds, systemToExtract, extractById]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(
      (l) =>
        (l.description ?? '').toLowerCase().includes(q) ||
        l.extractConcepts.toLowerCase().includes(q),
    );
  }, [enriched, search]);

  const totals = useMemo(() => {
    const matched = enriched.filter((l) => l.status === 'matched');
    const overdue = enriched.filter((l) => l.status === 'overdue');
    const deferred = enriched.filter((l) => l.status === 'deferred');
    const sum = (arr: typeof enriched) => arr.reduce((s, l) => s + l.amount, 0);
    return {
      matchedCount: matched.length, matchedAmount: sum(matched),
      overdueCount: overdue.length, overdueAmount: sum(overdue),
      deferredCount: deferred.length, deferredAmount: sum(deferred),
    };
  }, [enriched]);

  const rowClass: Record<LineStatus, string> = {
    matched: 'bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50',
    overdue: 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50',
    deferred: 'bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50',
  };

  const statusBadge = (status: LineStatus) => {
    if (status === 'matched') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Correcto</Badge>;
    if (status === 'overdue') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Vencido</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Diferido</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Libro Banco</h2>
        <span className="text-sm text-muted-foreground">({systemLines.length} líneas)</span>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-xs font-medium text-green-700 dark:text-green-200">Correctos</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-100">{totals.matchedCount}</p>
          <p className="text-xs text-green-700 dark:text-green-200">${totals.matchedAmount.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs font-medium text-red-700 dark:text-red-200">Vencidos</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-100">{totals.overdueCount}</p>
          <p className="text-xs text-red-700 dark:text-red-200">${totals.overdueAmount.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-200">Diferidos</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-100">{totals.deferredCount}</p>
          <p className="text-xs text-amber-700 dark:text-amber-200">${totals.deferredAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-green-500/40" />Verde = Correcto (matcheado)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-red-500/40" />Rojo = Vencido</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-amber-500/40" />Amarillo = Diferido</span>
      </div>

      {/* Buscador */}
      <Input
        placeholder="Buscar por descripción o concepto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Tabla */}
      <div className="rounded-md border overflow-auto max-h-[60vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead>Descripción (Sistema)</TableHead>
              <TableHead>Fecha Emisión</TableHead>
              <TableHead>Fecha Vencimiento</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Concepto Extracto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {search.trim() ? `Sin resultados para "${search}"` : 'No hay líneas'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((line) => (
                <TableRow key={line.id} className={rowClass[line.status]}>
                  <TableCell>{statusBadge(line.status)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{line.description || '-'}</TableCell>
                  <TableCell>{formatCalendarDate(line.issueDate)}</TableCell>
                  <TableCell>{formatCalendarDate(line.dueDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">${line.amount.toFixed(2)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{line.extractConcepts || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {filtered.length < enriched.length && (
        <p className="text-xs text-muted-foreground">Mostrando {filtered.length} de {enriched.length} líneas</p>
      )}
    </div>
  );
}
