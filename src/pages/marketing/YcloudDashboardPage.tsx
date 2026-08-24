import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  clearTemplateAnalytics,
  fetchDashboard,
  fetchTemplateAnalytics,
} from '@/store/marketing/campaignsSlice';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { YCloudTemplate } from '@/types/marketing.types';

const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  PAUSED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  DISABLED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  ARCHIVED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CONNECTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  FLAGGED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  RESTRICTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  GREEN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  YELLOW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  RED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
};

function StatusPill({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cls = STATUS_CLASSES[value] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>
      {value}
    </span>
  );
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function templateKey(t: YCloudTemplate) {
  return `${t.id}|${t.name}|${t.language}|${t.wabaId}`;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}

export function YcloudDashboardPage() {
  const dispatch = useAppDispatch();
  const { dashboard, templateAnalytics, loadingDashboard, loadingAnalytics } =
    useAppSelector((s) => s.marketing);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [rangeDays, setRangeDays] = useState('30');

  useEffect(() => {
    void dispatch(fetchDashboard());
  }, [dispatch]);

  const approvedTemplates = useMemo(
    () => (dashboard?.templates.items ?? []).filter((t) => t.status === 'APPROVED'),
    [dashboard],
  );

  const filteredTemplates = useMemo(() => {
    const items = dashboard?.templates.items ?? [];
    if (statusFilter === 'ALL') return items;
    return items.filter((t) => t.status === statusFilter);
  }, [dashboard, statusFilter]);

  useEffect(() => {
    if (!selectedTemplateKey && approvedTemplates.length > 0) {
      setSelectedTemplateKey(templateKey(approvedTemplates[0]));
    }
  }, [approvedTemplates, selectedTemplateKey]);

  async function handleRefresh() {
    dispatch(clearTemplateAnalytics());
    try {
      await dispatch(fetchDashboard()).unwrap();
      toast.success('Dashboard actualizado');
    } catch {
      toast.error('No se pudo actualizar el dashboard');
    }
  }

  async function handleLoadAnalytics() {
    const tpl = approvedTemplates.find((t) => templateKey(t) === selectedTemplateKey);
    if (!tpl) {
      toast.error('Seleccioná una plantilla');
      return;
    }
    const days = Number(rangeDays);
    try {
      await dispatch(
        fetchTemplateAnalytics({
          wabaId: tpl.wabaId,
          officialTemplateId: tpl.id,
          startDate: dateDaysAgo(days - 1),
          endDate: todayIso(),
        }),
      ).unwrap();
    } catch {
      toast.error('No se pudieron cargar las métricas de la plantilla');
    }
  }

  const analyticsTotals = useMemo(() => {
    const points = templateAnalytics?.dataPoints ?? [];
    return points.reduce(
      (acc, p) => ({
        sent: acc.sent + p.sent,
        delivered: acc.delivered + p.delivered,
        failed: acc.failed + p.failed,
        read: acc.read + p.read,
        clicks: acc.clicks + p.clicks,
        uniqueReplies: acc.uniqueReplies + p.uniqueReplies,
      }),
      { sent: 0, delivered: 0, failed: 0, read: 0, clicks: 0, uniqueReplies: 0 },
    );
  }, [templateAnalytics]);

  const byStatus = dashboard?.templates.byStatus ?? {};
  const local = dashboard?.local;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard YCloud</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Balance, líneas, plantillas y métricas de WhatsApp
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="Actualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loadingDashboard ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loadingDashboard && !dashboard ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      ) : dashboard ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="Balance"
              value={
                dashboard.balance
                  ? formatMoney(dashboard.balance.amount, dashboard.balance.currency)
                  : '—'
              }
              hint={dashboard.balanceError ?? undefined}
            />
            <Kpi
              label="Líneas"
              value={dashboard.phones.length}
              hint={
                dashboard.phonesError
                  ?? `${dashboard.phones.filter((p) => p.status === 'CONNECTED').length} conectadas`
              }
            />
            <Kpi
              label="Plantillas"
              value={dashboard.templates.total}
              hint={`${byStatus['APPROVED'] ?? 0} aprobadas · ${byStatus['PENDING'] ?? 0} pendientes`}
            />
            <Kpi
              label="Envíos locales"
              value={(local?.campaigns.sentTotal ?? 0) + (local?.directMessages.total ?? 0)}
              hint={`${local?.directMessages.last7Days ?? 0} directos últimos 7 días`}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Líneas WhatsApp</h2>
            {dashboard.phonesError ? (
              <p className="text-sm text-destructive">{dashboard.phonesError}</p>
            ) : dashboard.phones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay números registrados en YCloud.</p>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Canal</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Número</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Calidad</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Límite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.phones.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5">{p.channelLabel ?? '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {p.displayPhoneNumber ?? p.phoneNumber}
                          </td>
                          <td className="px-4 py-2.5">{p.verifiedName ?? '—'}</td>
                          <td className="px-4 py-2.5"><StatusPill value={p.status} /></td>
                          <td className="px-4 py-2.5"><StatusPill value={p.qualityRating} /></td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {p.messagingLimit ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Plantillas</h2>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-44"
              >
                <option value="ALL">Todos los estados</option>
                {Object.keys(byStatus)
                  .sort()
                  .map((s) => (
                    <option key={s} value={s}>
                      {s} ({byStatus[s]})
                    </option>
                  ))}
              </Select>
            </div>
            {dashboard.templatesError ? (
              <p className="text-sm text-destructive">{dashboard.templatesError}</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay plantillas para el filtro elegido.</p>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Idioma</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Categoría</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Calidad</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Canal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.map((t) => (
                        <tr key={templateKey(t)} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 font-medium">{t.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{t.language}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{t.category}</td>
                          <td className="px-4 py-2.5"><StatusPill value={t.status} /></td>
                          <td className="px-4 py-2.5"><StatusPill value={t.qualityRating} /></td>
                          <td className="px-4 py-2.5 text-muted-foreground">{t.channelLabel ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Performance por plantilla</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-[220px] flex-1">
                <label className="text-xs text-muted-foreground">Plantilla aprobada</label>
                <Select
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                >
                  {approvedTemplates.length === 0 ? (
                    <option value="">Sin plantillas aprobadas</option>
                  ) : (
                    approvedTemplates.map((t) => (
                      <option key={templateKey(t)} value={templateKey(t)}>
                        {t.name} ({t.language}){t.channelLabel ? ` · ${t.channelLabel}` : ''}
                      </option>
                    ))
                  )}
                </Select>
              </div>
              <div className="space-y-1 w-36">
                <label className="text-xs text-muted-foreground">Rango</label>
                <Select value={rangeDays} onChange={(e) => setRangeDays(e.target.value)}>
                  <option value="7">Últimos 7 días</option>
                  <option value="30">Últimos 30 días</option>
                  <option value="90">Últimos 90 días</option>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!selectedTemplateKey || loadingAnalytics}
                onClick={() => void handleLoadAnalytics()}
              >
                {loadingAnalytics ? 'Cargando…' : 'Ver métricas'}
              </Button>
            </div>

            {templateAnalytics ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Kpi label="Enviados" value={analyticsTotals.sent} />
                  <Kpi label="Entregados" value={analyticsTotals.delivered} />
                  <Kpi label="Leídos" value={analyticsTotals.read} />
                  <Kpi label="Fallidos" value={analyticsTotals.failed} />
                  <Kpi label="Clicks" value={analyticsTotals.clicks} />
                  <Kpi label="Respuestas únicas" value={analyticsTotals.uniqueReplies} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {templateAnalytics.templateName} · {templateAnalytics.startDate} → {templateAnalytics.endDate}
                  {' · '}Insights Meta: {templateAnalytics.analyticsStatus}
                </p>
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[280px]">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Enviados</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Entregados</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Leídos</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Fallidos</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...templateAnalytics.dataPoints].reverse().map((p) => (
                          <tr key={p.date} className="border-b border-border last:border-0">
                            <td className="px-4 py-2">{p.date}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{p.sent}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{p.delivered}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{p.read}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{p.failed}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{p.clicks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Elegí una plantilla y un rango para ver sent / delivered / read / clicks.
              </p>
            )}
          </section>

          {local ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Actividad en la plataforma</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Campañas" value={local.campaigns.total} />
                <Kpi
                  label="En ejecución"
                  value={local.campaigns.byStatus['RUNNING'] ?? 0}
                />
                <Kpi label="Enviados (campañas)" value={local.campaigns.sentTotal} />
                <Kpi label="Fallidos (campañas)" value={local.campaigns.failedTotal} />
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No se pudo cargar el dashboard.
        </div>
      )}
    </div>
  );
}
