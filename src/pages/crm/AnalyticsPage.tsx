import { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { MapPin, GitCompare } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchAnalyticsTotales,
  fetchAnalyticsEvolution,
  fetchAnalyticsDemand,
  fetchAnalyticsStatus,
  fetchAnalyticsYearlyComparison,
  fetchComparisonSnapshot,
  type ComparisonSnapshot,
} from '@/store/crm/analyticsSlice';
import { ReportFiltersModal } from '@/components/crm/ReportFiltersModal';
import { FollowUpEventsWidget } from '@/components/crm/FollowUpEventsWidget';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CHART_COLORS = [
  'hsl(221.2 83.2% 53.3%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(0 84% 60%)',
  'hsl(200 80% 55%)',
  'hsl(160 60% 45%)',
  'hsl(320 70% 55%)',
];
const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  DERIVADO_A_DISTRIBUIDOR: 'Derivado a dist.',
  NO_CONTESTO: 'No contestó',
  SE_COTIZO_Y_PENDIENTE: 'Cotizado pendiente',
  SE_COTIZO_Y_NO_INTERESO: 'No interesó',
  COMPRO: 'Compró',
};
function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '12px',
  },
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = delta > 0;
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600 dark:text-green-200' : 'text-red-600 dark:text-red-200'}`}>
      {positive ? '+' : ''}{delta}
    </span>
  );
}

export function AnalyticsPage() {
  const dispatch = useAppDispatch();
  const { totales, evolution, yearlyComparison, byProduct, statusPurchase, followUpEvents, loading } =
    useAppSelector((s) => s.analytics);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [comparisonMode, setComparisonMode] = useState<'none' | 'compare'>('none');
  const [compareYear, setCompareYear] = useState(currentYear - 1);
  const [comparisonSnapshot, setComparisonSnapshot] = useState<ComparisonSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const comparisonEnabled = comparisonMode === 'compare' && compareYear !== year;

  // Load main year data
  useEffect(() => {
    void dispatch(fetchAnalyticsTotales(year));
    void dispatch(fetchAnalyticsEvolution(year));
    void dispatch(fetchAnalyticsDemand(year));
    void dispatch(fetchAnalyticsStatus(year));
  }, [dispatch, year]);

  // Load yearly comparison data
  useEffect(() => {
    if (comparisonEnabled) {
      void dispatch(fetchAnalyticsYearlyComparison([year, compareYear]));
    }
  }, [dispatch, comparisonEnabled, year, compareYear]);

  // Load comparison snapshot
  useEffect(() => {
    if (!comparisonEnabled) {
      setComparisonSnapshot(null);
      return;
    }
    setLoadingSnapshot(true);
    dispatch(fetchComparisonSnapshot(compareYear))
      .unwrap()
      .then((snapshot) => setComparisonSnapshot(snapshot))
      .catch(() => toast.error('Error al cargar datos de comparación'))
      .finally(() => setLoadingSnapshot(false));
  }, [dispatch, comparisonEnabled, compareYear]);

  // --- Prepared chart data ---

  const evolutionData = useMemo(() => {
    const singleYearData = evolution.map((d, idx) => ({
      month: MONTH_LABELS[idx] ?? d.date,
      total: d.total,
    }));

    if (!comparisonEnabled || yearlyComparison.length === 0) return singleYearData;

    return MONTH_LABELS.map((month, idx) => {
      const point = yearlyComparison[idx] ?? {};
      return {
        month,
        [String(year)]: Number(point[`y${year}`] ?? 0),
        [String(compareYear)]: Number(point[`y${compareYear}`] ?? 0),
      };
    });
  }, [evolution, yearlyComparison, comparisonEnabled, year, compareYear]);

  const channelsData = useMemo(() => {
    const base = totales?.byChannel ?? [];
    if (!comparisonEnabled || !comparisonSnapshot) return base;

    const compareMap = new Map(comparisonSnapshot.byChannel.map((c) => [c.channel, c.total]));
    const channels = Array.from(new Set([...base.map((c) => c.channel), ...compareMap.keys()]));
    return channels.map((channel) => {
      const current = base.find((c) => c.channel === channel)?.total ?? 0;
      const compare = compareMap.get(channel) ?? 0;
      return { channel, current, compare, delta: current - compare };
    }).sort((a, b) => b.current - a.current);
  }, [totales, comparisonSnapshot, comparisonEnabled]);

  const demandData = useMemo(() => {
    const INVALID = new Set(['', '-', 'sin dato', 'null', 'undefined']);
    const clean = (byProduct ?? []).filter((d) => {
      const v = String(d.product ?? '').trim().toLowerCase();
      return v && !INVALID.has(v);
    });
    const top10 = clean.slice(0, 10);

    if (!comparisonEnabled || !comparisonSnapshot) return top10;

    const compareMap = new Map(
      comparisonSnapshot.byProduct
        .filter((d) => { const v = String(d.product ?? '').trim().toLowerCase(); return v && !INVALID.has(v); })
        .map((d) => [d.product, d.total]),
    );
    return top10.map((d) => ({
      product: d.product,
      current: d.total,
      compare: compareMap.get(d.product) ?? 0,
      delta: d.total - (compareMap.get(d.product) ?? 0),
    }));
  }, [byProduct, comparisonSnapshot, comparisonEnabled]);

  const statusData = useMemo(() => {
    const base = (statusPurchase ?? []).map((s) => ({
      name: ESTADO_LABELS[s.status] ?? s.status,
      value: s.total,
      status: s.status,
    }));
    if (!comparisonEnabled || !comparisonSnapshot) return base;

    const compareMap = new Map(comparisonSnapshot.statusPurchase.map((s) => [s.status, s.total]));
    return base.map((s) => ({
      ...s,
      compare: compareMap.get(s.status) ?? 0,
      delta: s.value - (compareMap.get(s.status) ?? 0),
    }));
  }, [statusPurchase, comparisonSnapshot, comparisonEnabled]);

  const isComparisonChart = comparisonEnabled && comparisonSnapshot !== null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-foreground">Dashboard CRM</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <MapPin className="h-4 w-4" />
            PDF Ubicaciones
          </button>

          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Comparison toggle */}
          <button
            onClick={() => setComparisonMode((m) => (m === 'none' ? 'compare' : 'none'))}
            className={[
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors',
              comparisonMode === 'compare'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            ].join(' ')}
          >
            <GitCompare className="h-4 w-4" />
            Comparar
          </button>

          {/* Compare year selector */}
          {comparisonMode === 'compare' && (
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {[currentYear - 3, currentYear - 2, currentYear - 1, currentYear].filter((y) => y !== year).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 h-20 animate-pulse bg-muted" />
          ))
        ) : (
          <>
            <KpiCard label="Total contactos" value={totales?.totalContacts ?? 0} />
            <KpiCard label="Reconsultas" value={totales?.totalReconsultas ?? 0} />
            <KpiCard label="Primeras consultas" value={totales?.firstTimeContacts ?? 0} />
          </>
        )}
      </div>

      {/* Evolution chart */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-4">
          Evolución mensual{comparisonEnabled ? ` — ${year} vs ${compareYear}` : ''}
        </h3>
        {loading ? (
          <div className="h-48 animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip {...tooltipStyle} />
              {isComparisonChart ? (
                <>
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey={String(year)} stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} name={String(year)} />
                  <Line type="monotone" dataKey={String(compareYear)} stroke={CHART_COLORS[2]} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name={String(compareYear)} />
                </>
              ) : (
                <Line type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} name="Contactos" />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Channels + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Canales de adquisición</h3>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted rounded" />
          ) : isComparisonChart ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1.5 font-medium">Canal</th>
                    <th className="text-right py-1.5 font-medium">{year}</th>
                    <th className="text-right py-1.5 font-medium">{compareYear}</th>
                    <th className="text-right py-1.5 font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(channelsData as { channel: string; current: number; compare: number; delta: number }[]).map((c) => (
                    <tr key={c.channel}>
                      <td className="py-1.5 text-foreground">{c.channel}</td>
                      <td className="py-1.5 text-right text-foreground font-medium">{c.current}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{c.compare}</td>
                      <td className="py-1.5 text-right"><DeltaBadge delta={c.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={channelsData as { channel: string; total: number }[]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="channel" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Contactos" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Estado de compra</h3>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted rounded" />
          ) : isComparisonChart ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1.5 font-medium">Estado</th>
                    <th className="text-right py-1.5 font-medium">{year}</th>
                    <th className="text-right py-1.5 font-medium">{compareYear}</th>
                    <th className="text-right py-1.5 font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(statusData as unknown as { name: string; value: number; compare: number; delta: number }[]).map((s) => (
                    <tr key={s.name}>
                      <td className="py-1.5 text-foreground">{s.name}</td>
                      <td className="py-1.5 text-right text-foreground font-medium">{s.value}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{s.compare}</td>
                      <td className="py-1.5 text-right"><DeltaBadge delta={s.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData as { name: string; value: number }[]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Demand by product */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-4">Demanda por producto (Top 10)</h3>
        {loading ? (
          <div className="h-56 animate-pulse bg-muted rounded" />
        ) : isComparisonChart ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Producto</th>
                  <th className="text-right py-1.5 font-medium">{year}</th>
                  <th className="text-right py-1.5 font-medium">{compareYear}</th>
                  <th className="text-right py-1.5 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(demandData as { product: string; current: number; compare: number; delta: number }[]).map((d) => (
                  <tr key={d.product}>
                    <td className="py-1.5 text-foreground max-w-[200px] truncate">{d.product}</td>
                    <td className="py-1.5 text-right text-foreground font-medium">{d.current}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{d.compare}</td>
                    <td className="py-1.5 text-right"><DeltaBadge delta={d.delta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={demandData as { product: string; total: number }[]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                dataKey="product"
                type="category"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                width={140}
                tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 20)}…` : v)}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="total" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} name="Consultas" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Loading snapshot indicator */}
      {loadingSnapshot && (
        <div className="text-center py-2 text-xs text-muted-foreground animate-pulse">
          Cargando datos de comparación ({compareYear})...
        </div>
      )}

      {/* Seguimiento de clientes */}
      <FollowUpEventsWidget />

      {showPdfModal && <ReportFiltersModal onClose={() => setShowPdfModal(false)} />}
    </div>
  );
}
