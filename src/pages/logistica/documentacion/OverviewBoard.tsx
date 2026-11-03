import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { ComplianceOverviewRow, ComplianceStatus, ComplianceSubject } from '@/types/logistica.types';
import { STATUS_LABEL, StatusBadge } from './status';

export const SUBJECT_LABEL: Record<ComplianceSubject, string> = {
  TRANSPORT: 'Empresa',
  PERSON: 'Persona',
  VEHICLE: 'Vehículo',
};

/**
 * One field per filter; every filter is an AND over the rows. A plant filter (delivery C)
 * only needs a new field here plus its clause in filterOverviewRows.
 */
export interface OverviewFilters {
  transportId: string;
  subject: 'all' | ComplianceSubject;
  status: 'all' | ComplianceStatus;
  pendingOnly: boolean;
}

export const EMPTY_OVERVIEW_FILTERS: OverviewFilters = {
  transportId: '',
  subject: 'all',
  status: 'all',
  pendingOnly: false,
};

export function filterOverviewRows(rows: ComplianceOverviewRow[], filters: OverviewFilters): ComplianceOverviewRow[] {
  return rows.filter((row) =>
    (!filters.transportId || row.transportId === filters.transportId)
    && (filters.subject === 'all' || row.subject === filters.subject)
    && (filters.status === 'all' || row.status === filters.status)
    && (!filters.pendingOnly || row.pendingReview > 0));
}

function rowName(row: ComplianceOverviewRow): string {
  if (row.subject === 'PERSON' && row.role) {
    return `${row.name} · ${row.role === 'DUENO' ? 'Dueño' : 'Chofer'}`;
  }
  return row.name;
}

export function OverviewBoard({
  rows,
  loading,
  onOpen,
}: {
  rows: ComplianceOverviewRow[];
  loading: boolean;
  onOpen: (row: ComplianceOverviewRow) => void;
}) {
  const [filters, setFilters] = useState<OverviewFilters>(EMPTY_OVERVIEW_FILTERS);
  const transports = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) byId.set(row.transportId, row.transportName);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);
  const visible = useMemo(() => filterOverviewRows(rows, filters), [rows, filters]);
  const set = <K extends keyof OverviewFilters>(key: K, value: OverviewFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4 items-end">
        <div>
          <Label htmlFor="overview-transport">Transporte</Label>
          <Select id="overview-transport" value={filters.transportId} onChange={(e) => set('transportId', e.target.value)}>
            <option value="">Todos</option>
            {transports.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="overview-subject">Tipo</Label>
          <Select
            id="overview-subject"
            value={filters.subject}
            onChange={(e) => set('subject', e.target.value as OverviewFilters['subject'])}
          >
            <option value="all">Todos</option>
            {(Object.keys(SUBJECT_LABEL) as ComplianceSubject[]).map((key) => (
              <option key={key} value={key}>{SUBJECT_LABEL[key]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="overview-status">Estado</Label>
          <Select
            id="overview-status"
            value={filters.status}
            onChange={(e) => set('status', e.target.value as OverviewFilters['status'])}
          >
            <option value="all">Todos</option>
            {(['missing', 'expired', 'expiring', 'ok'] as ComplianceStatus[]).map((key) => (
              <option key={key} value={key}>{STATUS_LABEL[key]}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm h-9">
          <input
            type="checkbox"
            checked={filters.pendingOnly}
            onChange={(e) => set('pendingOnly', e.target.checked)}
          />
          Solo pendientes de revisión
        </label>
      </div>

      {loading ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transporte</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Próximo vencimiento</TableHead>
                <TableHead className="text-right">Pendientes de revisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Sin resultados para estos filtros.</TableCell>
                </TableRow>
              ) : visible.map((row) => (
                <TableRow
                  key={`${row.transportId}-${row.subject}-${row.subjectUserId ?? ''}-${row.vehicleId ?? ''}`}
                  className="cursor-pointer"
                  onClick={() => onOpen(row)}
                >
                  <TableCell>{row.transportName}</TableCell>
                  <TableCell>{SUBJECT_LABEL[row.subject]}</TableCell>
                  <TableCell className="font-medium">{rowName(row)}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell>{row.nextExpiresAt ?? '—'}</TableCell>
                  <TableCell className="text-right">{row.pendingReview > 0 ? row.pendingReview : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
