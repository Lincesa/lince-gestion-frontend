import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { conciliacionesApi } from '@/api/conciliaciones';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { ReconciliationDashboard, ReconciliationQualityDiagnostics, ReconciliationQualityIssue } from '@/types/conciliaciones.types';

const COMPANY_OPTIONS = ['Lince', 'Lercara', 'Zumbi'];

const qualityContext = (issue: ReconciliationQualityIssue) => {
  const date = issue.cutDate ? new Date(issue.cutDate).toLocaleDateString() : null;
  return [issue.company, issue.bankName, issue.accountRef, date].filter(Boolean).join(' · ') || 'Sin contexto adicional';
};

const formatMoney = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

const fortnightLabel = (fortnight: 'first' | 'second') => fortnight === 'first' ? '1ra quincena' : '2da quincena';

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} aria-hidden="true" />;
}

function MetricValue({ loading, children }: { loading: boolean; children: ReactNode }) {
  if (loading) return <SkeletonBlock className="h-8 w-40 max-w-full" />;
  return <div className="break-words text-xl font-bold leading-tight sm:text-2xl 2xl:text-3xl">{children}</div>;
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

function SummaryRowMobile({ row }: { row: ReconciliationDashboard['rows'][number] }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{row.month} · {fortnightLabel(row.fortnight)}</p>
          <p className="text-xs text-muted-foreground">{row.company || '-'} · {row.bankName || '-'} · {row.accountRef || 'sin cuenta'}</p>
        </div>
        <Badge variant="outline">{row.runCount} conc.</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Gastos</span><br /><strong>{formatMoney(row.expensesAmount)}</strong></div>
        <div><span className="text-muted-foreground">Dejados fuera</span><br /><strong>{formatMoney(row.excludedAmount)}</strong></div>
        <div><span className="text-muted-foreground">Sin match</span><br /><strong>{formatMoney(row.unmatchedExtractAmount + row.unmatchedSystemAmount)}</strong></div>
        <div><span className="text-muted-foreground">Pendientes</span><br /><strong>{row.pendingOpenCount}</strong></div>
      </div>
    </div>
  );
}

export function ConciliacionesDashboardPage() {
  const navigate = useNavigate();
  const [qualityDiagnostics, setQualityDiagnostics] = useState<ReconciliationQualityDiagnostics | null>(null);
  const [dashboard, setDashboard] = useState<ReconciliationDashboard | null>(null);
  const [companyFilter, setCompanyFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [qualityLoading, setQualityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const company = companyFilter || undefined;
    const from = fromFilter || undefined;
    const to = toFilter || undefined;

    setDashboardLoading(true);
    conciliacionesApi.getDashboard({ company, from, to })
      .then((value) => {
        if (!cancelled) setDashboard(value);
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
  }, [companyFilter, fromFilter, toFilter]);

  const totalIssues = qualityDiagnostics?.summary.totalIssues ?? 0;
  const summary = dashboard?.summary;
  const hasActiveFilters = Boolean(companyFilter || fromFilter || toFilter);
  const excludedConceptRows = useMemo(() => (dashboard?.rows.flatMap((row) =>
    row.excludedConcepts.map((concept) => ({
      key: [row.month, row.fortnight, row.company, row.bankName, row.accountRef, concept.concept].join('|'),
      month: row.month,
      fortnight: row.fortnight,
      company: row.company,
      bankName: row.bankName,
      accountRef: row.accountRef,
      ...concept,
    })),
  ) ?? []), [dashboard]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard de Conciliaciones</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">Gastos, pendientes y diferencias por mes, quincena y banco.</p>
        </div>
        <Badge variant="outline" className="w-fit text-sm">Primer corte operativo</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Los importes se agrupan por fecha local Argentina.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,14rem)_minmax(9rem,11rem)_minmax(9rem,11rem)_auto] lg:items-end">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Empresa</span>
            <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-full">
              <option value="">Todas las empresas</option>
              {COMPANY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Desde</span>
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Hasta</span>
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              className="h-10 self-end text-left text-xs text-primary underline hover:no-underline sm:text-center lg:text-left"
              onClick={() => { setCompanyFilter(''); setFromFilter(''); setToFilter(''); }}
            >
              Limpiar filtros
            </button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Gastos incluidos</CardTitle></CardHeader>
          <CardContent>
            <MetricValue loading={dashboardLoading || !summary}>{summary ? formatMoney(summary.expensesAmount) : null}</MetricValue>
            <p className="mt-2 text-xs text-muted-foreground">{summary?.expensesCount ?? 0} mov. · no incluye dejados fuera</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Dejados fuera</CardTitle></CardHeader>
          <CardContent>
            <MetricValue loading={dashboardLoading || !summary}>{summary ? formatMoney(summary.excludedAmount) : null}</MetricValue>
            <p className="mt-2 text-xs text-muted-foreground">{summary?.excludedCount ?? 0} movimientos excluidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Pendientes abiertos</CardTitle></CardHeader>
          <CardContent>
            <MetricValue loading={dashboardLoading || !summary}>{summary?.pendingOpenCount}</MetricValue>
            <p className="mt-2 text-xs text-muted-foreground">{summary?.pendingCarriedCount ?? 0} arrastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Sin match</CardTitle></CardHeader>
          <CardContent>
            <MetricValue loading={dashboardLoading || !summary}>{summary ? formatMoney(summary.unmatchedExtractAmount + summary.unmatchedSystemAmount) : null}</MetricValue>
            <p className="mt-2 text-xs text-muted-foreground">Banco + sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Conciliaciones</CardTitle></CardHeader>
          <CardContent>
            <MetricValue loading={dashboardLoading || !summary}>{summary?.totalRuns}</MetricValue>
            <p className="mt-2 text-xs text-muted-foreground">En el período filtrado</p>
          </CardContent>
        </Card>
      </div>

      {dashboardLoading ? (
        <DashboardTableSkeleton />
      ) : dashboard && dashboard.rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Resumen por mes y quincena</CardTitle>
            <CardDescription>Primer corte usable para revisar gastos, pendientes y diferencias por banco/cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:hidden">
              {dashboard.rows.map((row) => <SummaryRowMobile key={[row.month, row.fortnight, row.company, row.bankName, row.accountRef].join('|')} row={row} />)}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Banco / cuenta</TableHead>
                    <TableHead>Gastos</TableHead>
                    <TableHead>Dejados fuera</TableHead>
                    <TableHead>Matcheado</TableHead>
                    <TableHead>Sin match</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Categorías</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.rows.map((row) => (
                    <TableRow key={[row.month, row.fortnight, row.company, row.bankName, row.accountRef].join('|')}>
                      <TableCell className="font-medium">{row.month}<br /><span className="text-xs text-muted-foreground">{fortnightLabel(row.fortnight)}</span></TableCell>
                      <TableCell>
                        <div className="font-medium">{row.bankName || '-'}</div>
                        <div className="text-xs text-muted-foreground">{row.company || '-'} · {row.accountRef || 'sin cuenta'} · {row.runCount} conciliación{row.runCount !== 1 ? 'es' : ''}</div>
                      </TableCell>
                      <TableCell>{formatMoney(row.expensesAmount)}<br /><span className="text-xs text-muted-foreground">{row.expensesCount} mov.</span></TableCell>
                      <TableCell>{formatMoney(row.excludedAmount)}<br /><span className="text-xs text-muted-foreground">{row.excludedCount} excl.</span></TableCell>
                      <TableCell>{formatMoney(row.matchedAmount)}<br /><span className="text-xs text-muted-foreground">{row.matchedCount} match</span></TableCell>
                      <TableCell>{formatMoney(row.unmatchedExtractAmount + row.unmatchedSystemAmount)}<br /><span className="text-xs text-muted-foreground">Bco {row.unmatchedExtractCount} · Sist {row.unmatchedSystemCount}</span></TableCell>
                      <TableCell>{row.pendingOpenCount} abiertos<br /><span className="text-xs text-muted-foreground">{row.pendingCarriedCount} arrastrados · {row.pendingResolvedCount} resueltos</span></TableCell>
                      <TableCell>
                        {row.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.categories.slice(0, 2).map((category) => (
                              <Badge key={category.name} variant="outline">{category.name}: {formatMoney(category.amount)}</Badge>
                            ))}
                            {row.categories.length > 2 && <Badge variant="outline">+{row.categories.length - 2}</Badge>}
                          </div>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sin datos para el filtro</CardTitle>
            <CardDescription>No hay conciliaciones con identidad bancaria para el rango seleccionado.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!dashboardLoading && excludedConceptRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conceptos dejados fuera</CardTitle>
            <CardDescription>Movimientos excluidos agrupados por concepto, como en la hoja de exportación.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Banco / cuenta</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {excludedConceptRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.month}<br /><span className="text-xs text-muted-foreground">{fortnightLabel(row.fortnight)}</span></TableCell>
                    <TableCell>
                      <div className="font-medium">{row.bankName || '-'}</div>
                      <div className="text-xs text-muted-foreground">{row.company || '-'} · {row.accountRef || 'sin cuenta'}</div>
                    </TableCell>
                    <TableCell>{row.concept}</TableCell>
                    <TableCell>{row.category || '-'}</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{formatMoney(row.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
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
                <CardDescription>La base está lista para seguir afinando métricas mensuales y quincenales.</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
