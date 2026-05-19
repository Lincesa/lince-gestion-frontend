import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { conciliacionesApi } from '@/api/conciliaciones';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { ReconciliationRun } from '@/types/conciliaciones.types';

const COMPANY_OPTIONS = ['Lince', 'Lercara', 'Zumbi'];

const COMPANY_COLORS: Record<string, string> = {
  Lince: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Lercara: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  Zumbi: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export function ConciliacionesDashboardPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    conciliacionesApi.listRuns(companyFilter || undefined)
      .then(setRuns)
      .catch(() => toast.error('No se pudieron cargar las conciliaciones'))
      .finally(() => setLoading(false));
  }, [companyFilter]);

  const handleDelete = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    if (!confirm('¿Borrar esta conciliación? No se puede deshacer.')) return;
    try {
      await conciliacionesApi.deleteRun(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      toast.success('Conciliación borrada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al borrar');
    }
  };

  const thisMonth = runs.filter((r) => {
    const date = new Date(r.createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  // Agrupar runs por empresa para mostrar secciones separadas
  const grouped = (() => {
    if (companyFilter) return [{ company: companyFilter, items: runs }];
    const map = new Map<string, ReconciliationRun[]>();
    for (const run of runs) {
      const key = run.company || '(Sin empresa)';
      const list = map.get(key) ?? [];
      list.push(run);
      map.set(key, list);
    }
    // Orden: empresas conocidas primero, luego sin empresa
    const order = [...COMPANY_OPTIONS, '(Sin empresa)'];
    return order.filter((k) => map.has(k)).map((k) => ({ company: k, items: map.get(k)! }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Conciliaciones Bancarias</h1>
          <p className="text-muted-foreground">Gestiona tus conciliaciones bancarias</p>
        </div>
        <Button onClick={() => navigate('/conciliaciones/nueva')}>
          <Plus className="mr-2 h-4 w-4" />Nueva Conciliación
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="grid gap-4 md:grid-cols-3 flex-1">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Conciliaciones</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{runs.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Este Mes</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{thisMonth}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Última Actualización</CardTitle></CardHeader>
            <CardContent><div className="text-sm font-medium">{runs[0] ? new Date(runs[0].createdAt).toLocaleDateString() : '-'}</div></CardContent>
          </Card>
        </div>
      </div>

      {/* Filtro por empresa */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filtrar por empresa:</span>
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

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Cargando...</div>
      ) : runs.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No hay conciliaciones{companyFilter ? ` para ${companyFilter}` : ''}. Creá una nueva para comenzar.
        </div>
      ) : (
        grouped.map(({ company, items }) => (
          <Card key={company}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{company}</CardTitle>
                <Badge className={COMPANY_COLORS[company] ?? 'bg-muted text-muted-foreground'}>
                  {items.length} conciliación{items.length !== 1 ? 'es' : ''}
                </Badge>
              </div>
              <CardDescription>
                {items.filter((r) => r.status !== 'CLOSED').length} abierta{items.filter((r) => r.status !== 'CLOSED').length !== 1 ? 's' : ''} · {items.filter((r) => r.status === 'CLOSED').length} cerrada{items.filter((r) => r.status === 'CLOSED').length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead><TableHead>Fecha</TableHead><TableHead>Banco</TableHead>
                    <TableHead>Estado</TableHead><TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((run) => (
                    <TableRow key={run.id} className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20" onClick={() => navigate(`/conciliaciones/run/${run.id}`)}>
                      <TableCell className="font-medium">{run.title || 'Sin título'}</TableCell>
                      <TableCell>{new Date(run.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{run.bankName || '-'}</TableCell>
                      <TableCell>
                        <Badge className={run.status === 'CLOSED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'}>
                          {run.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/conciliaciones/run/${run.id}`); }}>Ver Detalle</Button>
                        {run.status === 'OPEN' && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => void handleDelete(e, run.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
