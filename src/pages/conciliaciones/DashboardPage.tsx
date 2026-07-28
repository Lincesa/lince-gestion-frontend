import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { conciliacionesApi } from '@/api/conciliaciones';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import type { ReconciliationQualityDiagnostics, ReconciliationQualityIssue } from '@/types/conciliaciones.types';

const COMPANY_OPTIONS = ['Lince', 'Lercara', 'Zumbi'];

const qualityContext = (issue: ReconciliationQualityIssue) => {
  const date = issue.cutDate ? new Date(issue.cutDate).toLocaleDateString() : null;
  return [issue.company, issue.bankName, issue.accountRef, date].filter(Boolean).join(' · ') || 'Sin contexto adicional';
};

export function ConciliacionesDashboardPage() {
  const navigate = useNavigate();
  const [qualityDiagnostics, setQualityDiagnostics] = useState<ReconciliationQualityDiagnostics | null>(null);
  const [companyFilter, setCompanyFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    conciliacionesApi.getQualityDiagnostics(companyFilter || undefined)
      .then(setQualityDiagnostics)
      .catch(() => toast.error('No se pudieron cargar los diagnósticos de calidad'))
      .finally(() => setLoading(false));
  }, [companyFilter]);

  const totalIssues = qualityDiagnostics?.summary.totalIssues ?? 0;
  const totalRuns = qualityDiagnostics?.summary.totalRuns ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard de Conciliaciones</h1>
          <p className="text-muted-foreground">Datos pendientes hoy y base para el tablero operativo mensual.</p>
        </div>
        <Badge variant="outline" className="text-sm">En construcción</Badge>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Empresa:</span>
        <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-44">
          <option value="">Todas las empresas</option>
          {COMPANY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {companyFilter && (
          <button type="button" className="text-xs text-primary underline hover:no-underline" onClick={() => setCompanyFilter('')}>
            Limpiar filtro
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Datos a corregir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : totalIssues}</div>
            <p className="text-xs text-muted-foreground">Bloquean o ensucian métricas futuras.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Conciliaciones revisadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : totalRuns}</div>
            <p className="text-xs text-muted-foreground">Según el filtro de empresa.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Próximo tablero</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-primary" /> Mes / quincena
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Gastos, pendientes y evolución por banco.</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Cargando diagnóstico...</div>
      ) : totalIssues > 0 && qualityDiagnostics ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <CardTitle className="text-base">Datos a corregir antes del dashboard</CardTitle>
                <CardDescription>
                  {totalIssues} dato{totalIssues !== 1 ? 's' : ''} pendiente{totalIssues !== 1 ? 's' : ''} en {totalRuns} conciliación{totalRuns !== 1 ? 'es' : ''}.
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
                <CardDescription>La base está lista para avanzar con métricas agrupadas por mes y quincena.</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
