import { useEffect, useState } from 'react';
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

export function ConciliacionesDashboardPage() {
  const navigate = useNavigate();
  const [qualityDiagnostics, setQualityDiagnostics] = useState<ReconciliationQualityDiagnostics | null>(null);
  const [dashboard, setDashboard] = useState<ReconciliationDashboard | null>(null);
  const [companyFilter, setCompanyFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const company = companyFilter || undefined;
    const from = fromFilter || undefined;
    const to = toFilter || undefined;
    Promise.allSettled([
      conciliacionesApi.getQualityDiagnostics(company),
      conciliacionesApi.getDashboard({ company, from, to }),
    ])
      .then(([qualityResult, dashboardResult]) => {
        if (qualityResult.status === 'fulfilled') {
          setQualityDiagnostics(qualityResult.value);
        } else {
          toast.error('No se pudieron cargar los diagnósticos de calidad');
        }

        if (dashboardResult.status === 'fulfilled') {
          setDashboard(dashboardResult.value);
        } else {
          toast.error('No se pudo cargar el dashboard de conciliaciones');
        }
      })
      .finally(() => setLoading(false));
  }, [companyFilter, fromFilter, toFilter]);

  const totalIssues = qualityDiagnostics?.summary.totalIssues ?? 0;
  const summary = dashboard?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard de Conciliaciones</h1>
          <p className="text-muted-foreground">Gastos, pendientes y diferencias por mes, quincena y banco.</p>
        </div>
        <Badge variant="outline" className="text-sm">Primer corte operativo</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Los importes se agrupan por fecha local Argentina.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Empresa</span>
            <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-44">
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
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Hasta</span>
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          {(companyFilter || fromFilter || toFilter) && (
            <button
              type="button"
              className="pb-2 text-xs text-primary underline hover:no-underline"
              onClick={() => { setCompanyFilter(''); setFromFilter(''); setToFilter(''); }}
            >
              Limpiar filtros
            </button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Gastos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading || !summary ? '...' : formatMoney(summary.expensesAmount)}</div>
            <p className="text-xs text-muted-foreground">{summary?.expensesCount ?? 0} movimientos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Pendientes abiertos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading || !summary ? '...' : summary.pendingOpenCount}</div>
            <p className="text-xs text-muted-foreground">{summary?.pendingCarriedCount ?? 0} arrastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Sin match</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading || !summary ? '...' : formatMoney(summary.unmatchedExtractAmount + summary.unmatchedSystemAmount)}</div>
            <p className="text-xs text-muted-foreground">Banco + sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Conciliaciones</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading || !summary ? '...' : summary.totalRuns}</div>
            <p className="text-xs text-muted-foreground">En el período filtrado</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Cargando dashboard...</div>
      ) : dashboard && dashboard.rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Resumen por mes y quincena</CardTitle>
            <CardDescription>Primer corte usable para revisar gastos, pendientes y diferencias por banco/cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Banco / cuenta</TableHead>
                  <TableHead>Gastos</TableHead>
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
                    <TableCell>{formatMoney(row.matchedAmount)}<br /><span className="text-xs text-muted-foreground">{row.matchedCount} match</span></TableCell>
                    <TableCell>{formatMoney(row.unmatchedExtractAmount + row.unmatchedSystemAmount)}<br /><span className="text-xs text-muted-foreground">Bco {row.unmatchedExtractCount} · Sist {row.unmatchedSystemCount}</span></TableCell>
                    <TableCell>{row.pendingOpenCount} abiertos<br /><span className="text-xs text-muted-foreground">{row.pendingCarriedCount} arrastrados · {row.pendingResolvedCount} resueltos</span></TableCell>
                    <TableCell>
                      {row.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.categories.slice(0, 3).map((category) => (
                            <Badge key={category.name} variant="outline">{category.name}: {formatMoney(category.amount)}</Badge>
                          ))}
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      {totalIssues > 0 && qualityDiagnostics ? (
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
      ) : !loading && (
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
