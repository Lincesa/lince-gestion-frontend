import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { conciliacionesApi } from '@/api/conciliaciones';
import { AccountRefFields } from '@/components/conciliaciones/AccountRefFields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { BANK_OPTIONS, COMPANY_OPTIONS } from '@/constants/conciliaciones';
import type { ReconciliationDashboard, ReconciliationDashboardRow, ReconciliationQualityDiagnostics, ReconciliationQualityIssue } from '@/types/conciliaciones.types';
import { currentFortnightSelection, fortnightLabel, formatCalendarDate } from '@/utils/conciliaciones';

type MetricKey = 'excluded' | 'pending' | 'overdue' | 'unmatched';

const METRIC_META: Record<MetricKey, { title: string; description: string }> = {
  excluded: {
    title: 'Gastos y comisiones',
    description: 'Movimientos dejados fuera del match, agrupados por conciliación y concepto.',
  },
  pending: {
    title: 'Pendientes',
    description: 'Ítems pendientes abiertos por conciliación en la quincena.',
  },
  overdue: {
    title: 'Vencidos',
    description: 'Movimientos de sistema vencidos respecto de la fecha de corte.',
  },
  unmatched: {
    title: 'Sin match',
    description: 'Movimientos de banco y sistema sin conciliar en la quincena.',
  },
};

const qualityContext = (issue: ReconciliationQualityIssue) => {
  const date = issue.cutDate ? new Date(issue.cutDate).toLocaleDateString() : null;
  return [issue.company, issue.bankName, issue.accountRef, date].filter(Boolean).join(' · ') || 'Sin contexto adicional';
};

const formatMoney = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

const MONTH_OPTIONS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
] as const;

const initialFortnight = currentFortnightSelection();

function yearOptionsAround(monthKey: string) {
  const currentYear = Number(monthKey.slice(0, 4)) || new Date().getFullYear();
  const years = new Set<number>();
  for (let offset = -3; offset <= 1; offset += 1) years.add(currentYear + offset);
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} aria-hidden="true" />;
}

function MetricValue({ loading, children }: { loading: boolean; children: ReactNode }) {
  if (loading) return <SkeletonBlock className="h-8 w-40 max-w-full" />;
  return <div className="break-words text-xl font-bold leading-tight sm:text-2xl 2xl:text-3xl">{children}</div>;
}

function MetricCard({
  title,
  loading,
  value,
  hint,
  disabled,
  onClick,
}: {
  title: string;
  loading: boolean;
  value: ReactNode;
  hint: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="rounded-lg border bg-card text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/20 disabled:cursor-default disabled:opacity-70 disabled:hover:border-border disabled:hover:bg-card"
    >
      <div className="flex flex-col space-y-1.5 p-6 pb-3">
        <h3 className="text-sm font-medium leading-none tracking-tight">{title}</h3>
      </div>
      <div className="p-6 pt-0">
        <MetricValue loading={loading}>{value}</MetricValue>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        {!loading && !disabled && (
          <p className="mt-3 text-xs font-medium text-primary">Ver detalle</p>
        )}
      </div>
    </button>
  );
}

function runLabel(row: ReconciliationDashboardRow) {
  return row.title || row.bankName || 'Conciliación';
}

function runContext(row: ReconciliationDashboardRow) {
  return [row.company, row.bankName, row.accountRef || 'sin cuenta'].filter(Boolean).join(' · ');
}

function filterRowsForMetric(rows: ReconciliationDashboardRow[], metric: MetricKey) {
  return rows.filter((row) => {
    if (metric === 'excluded') return row.excludedCount > 0;
    if (metric === 'pending') return row.pendingOpenCount > 0;
    if (metric === 'overdue') return row.overdueCount > 0;
    return row.unmatchedExtractCount > 0 || row.unmatchedSystemCount > 0;
  });
}

function aggregateExcludedConcepts(rows: ReconciliationDashboardRow[]) {
  const map = new Map<string, { concept: string; category: string; amount: number; count: number }>();
  for (const row of rows) {
    for (const concept of row.excludedConcepts) {
      const key = `${concept.concept}\u0000${concept.category}`;
      const current = map.get(key) ?? {
        concept: concept.concept,
        category: concept.category,
        amount: 0,
        count: 0,
      };
      current.amount += concept.amount;
      current.count += concept.count;
      map.set(key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.concept.localeCompare(b.concept));
}

function DashboardTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <SkeletonBlock className="h-7 w-64 max-w-full" />
        <SkeletonBlock className="mt-2 h-4 w-96 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-14 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function RunRowMobile({
  row,
  onOpen,
}: {
  row: ReconciliationDashboard['rows'][number];
  onOpen: () => void;
}) {
  const unmatchedAmount = row.unmatchedExtractAmount + row.unmatchedSystemAmount;
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-accent/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{row.title || row.bankName || 'Conciliación'}</p>
          <p className="text-xs text-muted-foreground">
            {row.company || '-'} · {row.bankName || '-'} · {row.accountRef || 'sin cuenta'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Corte {formatCalendarDate(row.cutDate)} · {fortnightLabel(row.fortnight)}
          </p>
        </div>
        <Badge variant="outline">{row.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Gastos y comisiones</span><br /><strong>{formatMoney(row.excludedAmount)}</strong></div>
        <div><span className="text-muted-foreground">Pendientes</span><br /><strong>{row.pendingOpenCount}</strong></div>
        <div><span className="text-muted-foreground">Vencidos</span><br /><strong>{formatMoney(row.overdueAmount)}</strong></div>
        <div><span className="text-muted-foreground">Sin match</span><br /><strong>{formatMoney(unmatchedAmount)}</strong></div>
      </div>
    </button>
  );
}

export function ConciliacionesDashboardPage() {
  const navigate = useNavigate();
  const [qualityDiagnostics, setQualityDiagnostics] = useState<ReconciliationQualityDiagnostics | null>(null);
  const [dashboard, setDashboard] = useState<ReconciliationDashboard | null>(null);
  const [companyFilter, setCompanyFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(initialFortnight.month);
  const [fortnightFilter, setFortnightFilter] = useState<'first' | 'second'>(initialFortnight.fortnight);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [detailMetric, setDetailMetric] = useState<MetricKey | null>(null);
  const [systemBalanceDraft, setSystemBalanceDraft] = useState('');
  const [savingSystemBalance, setSavingSystemBalance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const company = companyFilter || undefined;
    const bankName = bankFilter || undefined;
    const accountRef = accountFilter || undefined;

    setDashboardLoading(true);
    conciliacionesApi.getDashboard({
      company,
      bankName,
      accountRef,
      month: monthFilter,
      fortnight: fortnightFilter,
    })
      .then((value) => {
        if (cancelled) return;
        setDashboard(value);
        setSystemBalanceDraft(
          value.systemReconciliationBalance == null ? '' : String(value.systemReconciliationBalance),
        );
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el dashboard de conciliaciones');
      })
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });

    setQualityLoading(true);
    conciliacionesApi.getQualityDiagnostics(company)
      .then((value) => {
        if (!cancelled) setQualityDiagnostics(value);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudieron cargar los diagnósticos de calidad');
      })
      .finally(() => {
        if (!cancelled) setQualityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyFilter, bankFilter, accountFilter, monthFilter, fortnightFilter]);

  const saveSystemReconciliationBalance = async () => {
    const trimmed = systemBalanceDraft.trim();
    const nextValue = trimmed === '' ? null : Number(trimmed.replace(',', '.'));
    if (trimmed !== '' && !Number.isFinite(nextValue)) {
      toast.error('Ingresá un número válido');
      return;
    }
    setSavingSystemBalance(true);
    try {
      const saved = await conciliacionesApi.updateDashboardSettings({
        systemReconciliationBalance: nextValue,
      });
      setDashboard((current) =>
        current
          ? { ...current, systemReconciliationBalance: saved.systemReconciliationBalance }
          : current,
      );
      setSystemBalanceDraft(
        saved.systemReconciliationBalance == null ? '' : String(saved.systemReconciliationBalance),
      );
      toast.success('Saldo guardado');
    } catch {
      toast.error('No se pudo guardar el saldo');
    } finally {
      setSavingSystemBalance(false);
    }
  };

  const totalIssues = qualityDiagnostics?.summary.totalIssues ?? 0;
  const summary = dashboard?.summary;
  const currentSelection = currentFortnightSelection();
  const hasSecondaryFilters = Boolean(companyFilter || bankFilter || accountFilter);
  const isCurrentFortnight = monthFilter === currentSelection.month && fortnightFilter === currentSelection.fortnight;
  const unmatchedTotal = summary
    ? summary.unmatchedExtractAmount + summary.unmatchedSystemAmount
    : 0;
  const selectedYear = monthFilter.slice(0, 4);
  const selectedMonth = monthFilter.slice(5, 7);
  const years = yearOptionsAround(monthFilter);

  const setMonthPart = (year: string, month: string) => {
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) return;
    setMonthFilter(`${year}-${month}`);
  };

  const detailRows = useMemo(
    () => (detailMetric && dashboard ? filterRowsForMetric(dashboard.rows, detailMetric) : []),
    [dashboard, detailMetric],
  );
  const excludedConceptRows = useMemo(
    () => (detailMetric === 'excluded' ? aggregateExcludedConcepts(detailRows) : []),
    [detailMetric, detailRows],
  );
  const detailMeta = detailMetric ? METRIC_META[detailMetric] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard de Conciliaciones</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Gastos y comisiones, pendientes, vencidos y sin match por conciliación de la quincena.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-sm">
          {fortnightLabel(fortnightFilter)} · {MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label ?? selectedMonth} {selectedYear}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>El período se resuelve automáticamente según la quincena elegida.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(11rem,14rem)_minmax(12rem,16rem)_minmax(16rem,22rem)_minmax(7rem,9rem)_minmax(10rem,12rem)_minmax(11rem,13rem)_auto] 2xl:items-end">
          <div className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Empresa</span>
            <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-full">
              <option value="">Todas las empresas</option>
              {COMPANY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Banco</span>
            <Select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="w-full">
              <option value="">Todos los bancos</option>
              {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          </div>
          <div className="grid gap-1 text-sm sm:col-span-2 xl:col-span-1">
            <span className="font-medium text-muted-foreground">Cuenta</span>
            <AccountRefFields
              value={accountFilter}
              onChange={setAccountFilter}
              showLabels={false}
              idPrefix="dashboard-account-filter"
            />
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Año</span>
            <Select
              value={selectedYear}
              onChange={(e) => setMonthPart(e.target.value, selectedMonth)}
              className="h-10 w-full"
            >
              {years.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Mes</span>
            <Select
              value={selectedMonth}
              onChange={(e) => setMonthPart(selectedYear, e.target.value)}
              className="h-10 w-full"
            >
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Quincena</span>
            <Select
              value={fortnightFilter}
              onChange={(e) => setFortnightFilter(e.target.value as 'first' | 'second')}
              className="h-10 w-full"
            >
              <option value="first">1ra quincena (1–15)</option>
              <option value="second">2da quincena (16–fin)</option>
            </Select>
          </div>
          {(hasSecondaryFilters || !isCurrentFortnight) && (
            <button
              type="button"
              className="h-10 self-end text-left text-xs text-primary underline hover:no-underline sm:text-center 2xl:text-left"
              onClick={() => {
                const next = currentFortnightSelection();
                setCompanyFilter('');
                setBankFilter('');
                setAccountFilter(null);
                setMonthFilter(next.month);
                setFortnightFilter(next.fortnight);
              }}
            >
              Volver a quincena actual
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saldo conciliación sistema</CardTitle>
          <CardDescription>
            Valor global editable. Por ahora solo se almacena; después se usará en operaciones con gastos y comisiones.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1 text-sm sm:max-w-xs">
            <span className="font-medium text-muted-foreground">Saldo</span>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={systemBalanceDraft}
              disabled={dashboardLoading || savingSystemBalance}
              onChange={(e) => setSystemBalanceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveSystemReconciliationBalance();
                }
              }}
            />
          </div>
          <button
            type="button"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={dashboardLoading || savingSystemBalance}
            onClick={() => void saveSystemReconciliationBalance()}
          >
            {savingSystemBalance ? 'Guardando…' : 'Guardar'}
          </button>
        </CardContent>
      </Card>

      {!dashboardLoading && dashboard?.identityGaps?.message && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <CardTitle className="text-base">Datos incompletos en el período</CardTitle>
                <CardDescription>{dashboard.identityGaps.message} Completalos en cada conciliación para mejorar el arrastre y los filtros.</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Gastos y comisiones"
          loading={dashboardLoading || !summary}
          value={summary ? formatMoney(summary.excludedAmount) : null}
          hint={`${summary?.excludedCount ?? 0} movimientos`}
          disabled={!summary || summary.excludedCount === 0}
          onClick={() => setDetailMetric('excluded')}
        />
        <MetricCard
          title="Pendientes"
          loading={dashboardLoading || !summary}
          value={summary?.pendingOpenCount}
          hint={`${summary?.pendingCarriedCount ?? 0} arrastrados`}
          disabled={!summary || summary.pendingOpenCount === 0}
          onClick={() => setDetailMetric('pending')}
        />
        <MetricCard
          title="Vencidos"
          loading={dashboardLoading || !summary}
          value={summary ? formatMoney(summary.overdueAmount) : null}
          hint={`${summary?.overdueCount ?? 0} del sistema`}
          disabled={!summary || summary.overdueCount === 0}
          onClick={() => setDetailMetric('overdue')}
        />
        <MetricCard
          title="Sin match"
          loading={dashboardLoading || !summary}
          value={summary ? formatMoney(unmatchedTotal) : null}
          hint={`Bco ${summary?.unmatchedExtractCount ?? 0} · Sist ${summary?.unmatchedSystemCount ?? 0}`}
          disabled={!summary || (summary.unmatchedExtractCount === 0 && summary.unmatchedSystemCount === 0)}
          onClick={() => setDetailMetric('unmatched')}
        />
      </div>

      {dashboardLoading ? (
        <DashboardTableSkeleton />
      ) : dashboard && dashboard.rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Por conciliación</CardTitle>
            <CardDescription>
              {dashboard.summary.totalRuns} conciliación{dashboard.summary.totalRuns !== 1 ? 'es' : ''} en {fortnightLabel(fortnightFilter)} de {monthFilter}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:hidden">
              {dashboard.rows.map((row) => (
                <RunRowMobile
                  key={row.runId}
                  row={row}
                  onOpen={() => navigate(`/conciliaciones/run/${row.runId}`)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Conciliación</TableHead>
                    <TableHead>Banco / cuenta</TableHead>
                    <TableHead>Gastos y comisiones</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Vencidos</TableHead>
                    <TableHead>Sin match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.rows.map((row) => {
                    const unmatchedAmount = row.unmatchedExtractAmount + row.unmatchedSystemAmount;
                    return (
                      <TableRow
                        key={row.runId}
                        className="cursor-pointer"
                        onClick={() => navigate(`/conciliaciones/run/${row.runId}`)}
                      >
                        <TableCell className="font-medium">
                          {row.title || 'Sin título'}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Corte {formatCalendarDate(row.cutDate)} · {row.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.bankName || '-'}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.company || '-'} · {row.accountRef || 'sin cuenta'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatMoney(row.excludedAmount)}
                          <br />
                          <span className="text-xs text-muted-foreground">{row.excludedCount} mov.</span>
                        </TableCell>
                        <TableCell>
                          {row.pendingOpenCount} abiertos
                          <br />
                          <span className="text-xs text-muted-foreground">{row.pendingCarriedCount} arrastrados</span>
                        </TableCell>
                        <TableCell>
                          {formatMoney(row.overdueAmount)}
                          <br />
                          <span className="text-xs text-muted-foreground">{row.overdueCount} mov.</span>
                        </TableCell>
                        <TableCell>
                          {formatMoney(unmatchedAmount)}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Bco {row.unmatchedExtractCount} · Sist {row.unmatchedSystemCount}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sin datos para la quincena</CardTitle>
            <CardDescription>
              No hay conciliaciones para {fortnightLabel(fortnightFilter)} de {monthFilter} con los filtros seleccionados.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {qualityLoading ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <SkeletonBlock className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
              <div className="w-full space-y-2">
                <SkeletonBlock className="h-5 w-72 max-w-full" />
                <SkeletonBlock className="h-4 w-96 max-w-full" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : totalIssues > 0 && qualityDiagnostics ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <CardTitle className="text-base">Datos a corregir antes de confiar en todo el dashboard</CardTitle>
                <CardDescription>
                  {totalIssues} dato{totalIssues !== 1 ? 's' : ''} pendiente{totalIssues !== 1 ? 's' : ''} en {qualityDiagnostics.summary.totalRuns} conciliación{qualityDiagnostics.summary.totalRuns !== 1 ? 'es' : ''}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-amber-200/70 dark:divide-amber-900/70">
              {qualityDiagnostics.issues.map((issue) => (
                <button
                  key={`${issue.runId}-${issue.code}`}
                  type="button"
                  className="flex w-full flex-col gap-1 py-3 text-left first:pt-0 last:pb-0 hover:text-primary"
                  onClick={() => navigate(`/conciliaciones/run/${issue.runId}`)}
                >
                  <span className="text-sm font-medium">{issue.message}</span>
                  <span className="text-xs text-muted-foreground">{qualityContext(issue)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <CardTitle className="text-base">Sin errores de datos detectados</CardTitle>
                <CardDescription>La base está lista para revisar la quincena seleccionada.</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <Dialog
        open={detailMetric != null}
        onClose={() => setDetailMetric(null)}
        title={detailMeta?.title ?? ''}
        description={detailMeta?.description}
        panelClassName="!max-w-4xl"
      >
        {detailRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay ítems para esta métrica en la quincena.</p>
        ) : (
          <div className="space-y-5">
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Conciliación</TableHead>
                    <TableHead>Banco / cuenta</TableHead>
                    <TableHead>
                      {detailMetric === 'pending' ? 'Cantidad' : 'Importe'}
                    </TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((row) => {
                    const unmatchedAmount = row.unmatchedExtractAmount + row.unmatchedSystemAmount;
                    const primary =
                      detailMetric === 'excluded' ? formatMoney(row.excludedAmount)
                        : detailMetric === 'pending' ? `${row.pendingOpenCount}`
                          : detailMetric === 'overdue' ? formatMoney(row.overdueAmount)
                            : formatMoney(unmatchedAmount);
                    const secondary =
                      detailMetric === 'excluded' ? `${row.excludedCount} mov.`
                        : detailMetric === 'pending' ? `${row.pendingCarriedCount} arrastrados`
                          : detailMetric === 'overdue' ? `${row.overdueCount} mov.`
                            : `Bco ${row.unmatchedExtractCount} · Sist ${row.unmatchedSystemCount}`;
                    return (
                      <TableRow
                        key={row.runId}
                        className="cursor-pointer"
                        onClick={() => {
                          setDetailMetric(null);
                          navigate(`/conciliaciones/run/${row.runId}`);
                        }}
                      >
                        <TableCell className="font-medium">
                          {runLabel(row)}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Corte {formatCalendarDate(row.cutDate)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{runContext(row)}</div>
                        </TableCell>
                        <TableCell>{primary}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{secondary}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {detailMetric === 'excluded' && excludedConceptRows.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Por concepto</h3>
                <div className="overflow-x-auto">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {excludedConceptRows.map((row) => (
                        <TableRow key={`${row.concept}|${row.category}`}>
                          <TableCell>{row.concept}</TableCell>
                          <TableCell>{row.category || '-'}</TableCell>
                          <TableCell>{row.count}</TableCell>
                          <TableCell>{formatMoney(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Clic en una conciliación para abrir el detalle completo.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
