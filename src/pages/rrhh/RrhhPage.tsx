import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, Info, RefreshCw, Save, Trash2 } from 'lucide-react';
import { CalendarioLaboralModal } from './CalendarioLaboralModal';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { asistenciaApi, type UpdateEmpleadoPayload } from '@/api/asistencia';
import { asistenciaCalendarApi } from '@/api/asistenciaCalendar';
import type { AttendanceKpis, EmpleadoAsistencia, FichajeAsistencia, MonthlyAttendanceDay, MonthlyAttendanceEmployeeRow, MonthlyAttendanceSummary, Planta, PinSummaryRow, ReporteEmpleadoRango, TipoAusencia } from '@/types';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { DEFAULT_HORAS_POR_PLANTA, resolveHorasEsperadasDia } from '@/constants/jornadas';

type EstadoOption = '' | '0' | '1';

interface RowDraft {
  estado: EstadoOption;
  empleadoId: string;
}

interface EditRowDraft {
  fichajeId: string;
  isNew: boolean;
  pin: string;
  planta: Planta | null;
  empleadoId: string | null;
  estado: 0 | 1;
  fecha: string;
  hora: string;
  saving: boolean;
  forOrphanId?: string;
  originalEstado?: 0 | 1;
  originalFecha?: string;
  originalHora?: string;
}

interface ManualFichajeRow {
  id: string;
  estado: 0 | 1;
  fecha: string;
  hora: string;
  saving: boolean;
}

interface DayExceptionForm {
  fecha: string;
  tipo: TipoAusencia;
  horasJustificadas: string;
  motivo: string;
}

const AR_TZ = 'America/Argentina/Buenos_Aires';
const DEFAULT_PLANTA: Planta = 'villa_nueva';

/** Devuelve las horas esperadas para la jornada de este agg.
 *  Resuelve por empleado (su override o el default de su planta).
 *  Si no se puede identificar al empleado, cae a 8 (el default más bajo). */
function jornadaHsForAgg(agg: { fichajes: FichajeAsistencia[] }): number {
  const emp = agg.fichajes.find((f) => f.empleado)?.empleado ?? null;
  if (!emp) return 8;
  return resolveHorasEsperadasDia({
    planta: emp.planta,
    horasEsperadasDia: emp.horasEsperadasDia,
  });
}

function jornadaMsForAgg(agg: { fichajes: FichajeAsistencia[] }): number {
  return jornadaHsForAgg(agg) * 60 * 60 * 1000;
}
const PLANTAS: { value: Planta; label: string }[] = [
  { value: 'villa_nueva', label: 'Villa María' },
  { value: 'tucuman', label: 'Tucumán' },
];

const TIPO_AUSENCIA_OPTIONS: { value: TipoAusencia; label: string }[] = [
  { value: 'licencia_medica', label: 'Licencia médica' },
  { value: 'permiso_direccion', label: 'Permiso dirección' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'compensacion', label: 'Compensación' },
  { value: 'otro', label: 'Otro' },
];

function plantaDisplayName(planta: Planta | string): string {
  if (planta === 'villa_nueva') return 'Villa María';
  if (planta === 'tucuman') return 'Tucumán';
  return planta.replace(/_/g, ' ');
}

function formatPct(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function statusLabel(status: MonthlyAttendanceEmployeeRow['status']): string {
  if (status === 'ok') return 'OK';
  if (status === 'critical') return 'Crítico';
  return 'Revisar';
}

function statusClass(status: MonthlyAttendanceEmployeeRow['status']): string {
  if (status === 'ok') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-500/25';
  if (status === 'critical') return 'bg-red-500/15 text-red-700 dark:text-red-200 ring-1 ring-red-500/25';
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-200 ring-1 ring-amber-500/25';
}

function alertClass(severity: AttendanceKpis['alerts'][number]['severity']): string {
  if (severity === 'critical') return 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100';
  if (severity === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100';
  return 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100';
}

function PlantaToggle({
  value,
  onChange,
}: {
  value: Planta;
  onChange: (planta: Planta) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
      {PLANTAS.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={[
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === v
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const fmtFichajeTiempo = new Intl.DateTimeFormat('es-AR', {
  timeZone: AR_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const fmtSoloHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: AR_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function formatFichajeHora(iso: string): string {
  return fmtFichajeTiempo.format(new Date(iso));
}

function formatSoloHora(iso: string): string {
  return fmtSoloHora.format(new Date(iso));
}

function formatDuracion(ms: number): string {
  if (ms < 0) return '—';
  if (ms === 0) return '0 min';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return '< 1 min';
}

function formatSaldoJornada(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 60000) return '0 min';
  return `${ms > 0 ? '+' : '-'} ${formatDuracion(abs)}`;
}

function unmatchedFichajeText(
  fichaje: { estado: 0 | 1; tiempo: string; planta?: Planta | null },
  fallbackPlanta?: Planta | string | null,
  warning = false,
): string {
  const marker = warning ? '⚠ ' : '';
  const planta = fichaje.planta ?? fallbackPlanta ?? null;
  if (planta === 'villa_nueva') {
    return `${marker}Fichaje sin emparejar · ${formatSoloHora(fichaje.tiempo)}`;
  }
  const label = fichaje.estado === 0 ? 'Entrada sin salida' : 'Salida sin entrada';
  return `${marker}${label} ${formatSoloHora(fichaje.tiempo)}`;
}

function unmatchedFichajeHeading(fichaje: { estado: 0 | 1; planta?: Planta | null }): string {
  if (fichaje.planta === 'villa_nueva') return 'Fichaje sin emparejar';
  return fichaje.estado === 0 ? 'Entrada sin emparejar' : 'Salida sin emparejar';
}

function duracionTotalClass(totalMs: number, tieneIntervalosValidos: boolean, msJornada: number): string {
  if (!tieneIntervalosValidos) {
    return 'bg-muted/40 text-muted-foreground';
  }
  if (totalMs >= msJornada) {
    return 'bg-emerald-500/25 text-emerald-900 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500/30';
  }
  return 'bg-red-500/25 text-red-900 dark:text-red-100 font-semibold ring-1 ring-red-500/30';
}

function saldoJornadaClass(saldoMs: number, tieneIntervalosValidos: boolean): string {
  if (!tieneIntervalosValidos) {
    return 'bg-muted/40 text-muted-foreground';
  }
  if (Math.abs(saldoMs) < 60000) {
    return 'bg-muted/60 text-foreground ring-1 ring-border';
  }
  if (saldoMs > 0) {
    return 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500/30';
  }
  return 'bg-red-500/20 text-red-900 dark:text-red-100 ring-1 ring-red-500/30';
}

function todayYmdAr(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function currentMonthAr(): string {
  return todayYmdAr().slice(0, 7);
}

function monthRangeFromMonth(month: string): { desde: string; hasta: string } {
  const [year, monthNumber] = month.split('-').map((part) => Number(part));
  const last = new Date(Date.UTC(year, monthNumber, 0, 12, 0, 0));
  const hasta = [
    last.getUTCFullYear(),
    String(last.getUTCMonth() + 1).padStart(2, '0'),
    String(last.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return { desde: `${month}-01`, hasta: hasta > todayYmdAr() ? todayYmdAr() : hasta };
}


function tiempoYmdEnAr(iso: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function tiempoHmsEnAr(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === t)?.value ?? '0').padStart(2, '0');
  return `${g('hour')}:${g('minute')}:${g('second')}`;
}

function arFechaYHoraToIso(fechaYmd: string, horaHms: string): string {
  const hms = horaHms.length === 5 ? `${horaHms}:00` : horaHms;
  const parsed = new Date(`${fechaYmd}T${hms}-03:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Fecha u hora inválida');
  }
  return parsed.toISOString();
}

function fichajeEmpleadoLabel(f: FichajeAsistencia): string {
  if (f.empleado) {
    return `${f.empleado.firstName} ${f.empleado.lastName}`;
  }
  return `PIN ${f.pin}`;
}

function addDaysYmdAr(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map((s) => parseInt(s, 10));
  const refUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(refUtc + delta * 86400000));
}

function formatDayHeading(dayKey: string): string {
  const [y, mo, da] = dayKey.split('-').map((s) => parseInt(s, 10));
  const refUtc = Date.UTC(y, mo - 1, da, 12, 0, 0);
  return new Date(refUtc).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: AR_TZ,
  });
}

function employeeKey(f: FichajeAsistencia): string {
  // Agrupamos por planta+pin (identidad física del dispositivo) y NO por empleadoId,
  // porque fichajes del mismo empleado pueden tener empleadoId=null si aún no fueron
  // reconciliados. Usar pin garantiza que entrada y salida siempre queden en el mismo
  // grupo aunque una de las dos tenga empleadoId vacío.
  return `${f.planta ?? ''}:${f.pin}`;
}

interface FichajePair {
  entrada: FichajeAsistencia;
  salida: FichajeAsistencia;
  ms: number;
}

interface EmployeeDayAgg {
  key: string;
  fichajes: FichajeAsistencia[];
  pairs: FichajePair[];
  pairsEntradaDiaAnterior: FichajePair[];
  pairsSalidaDiaSiguiente: FichajePair[];
  orphanEntradas: FichajeAsistencia[];
  orphanSalidas: FichajeAsistencia[];
  totalMs: number;
}

function aggHasValidPairs(agg: EmployeeDayAgg): boolean {
  return agg.pairs.length > 0 || agg.pairsEntradaDiaAnterior.length > 0;
}

function buildEmployeeDayAggregates(items: FichajeAsistencia[], requestedDay: string): EmployeeDayAgg[] {
  // Precomputamos los ms para evitar parsear `Date` decenas de veces por fichaje.
  const tiempoMs = new Map<string, number>();
  const msOf = (f: FichajeAsistencia): number => {
    let v = tiempoMs.get(f.id);
    if (v === undefined) {
      v = new Date(f.tiempo).getTime();
      tiempoMs.set(f.id, v);
    }
    return v;
  };

  const byEmp = new Map<string, FichajeAsistencia[]>();
  for (const r of items) {
    const k = employeeKey(r);
    const arr = byEmp.get(k) ?? [];
    arr.push(r);
    byEmp.set(k, arr);
  }

  const aggs: EmployeeDayAgg[] = [];

  for (const [key, evs] of byEmp) {
    const sorted = [...evs].sort((a, b) => msOf(a) - msOf(b));
    const allPairs: FichajePair[] = [];
    const allOrphanEntradas: FichajeAsistencia[] = [];
    const allOrphanSalidas: FichajeAsistencia[] = [];
    const openEntradas: FichajeAsistencia[] = [];

    for (const ev of sorted) {
      if (ev.estado === 0) {
        openEntradas.push(ev);
      } else {
        const salidaMs = msOf(ev);
        while (
          openEntradas.length > 0 &&
          msOf(openEntradas[0]) >= salidaMs
        ) {
          allOrphanEntradas.push(openEntradas.shift()!);
        }
        const entrada = openEntradas.shift();
        if (entrada) {
          const ms = salidaMs - msOf(entrada);
          if (ms >= 0) {
            allPairs.push({ entrada, salida: ev, ms });
          } else {
            allOrphanSalidas.push(ev);
            openEntradas.unshift(entrada);
          }
        } else {
          allOrphanSalidas.push(ev);
        }
      }
    }
    allOrphanEntradas.push(...openEntradas);

    // Turnos nocturnos (Tucumán): el backend devuelve desde las 00:00 del día anterior
    // y hasta las 14:00 del día siguiente. El total se imputa al día de salida.
    // - pairs: tramos del mismo día calendario (suman al total).
    // - pairsEntradaDiaAnterior: cierran hoy pero empezaron ayer (suman al total).
    // - pairsSalidaDiaSiguiente: empiezan hoy y cierran mañana (informativos, no suman).
    const pairsSalidaEnDia = allPairs.filter((p) => tiempoYmdEnAr(p.salida.tiempo) === requestedDay);
    const pairs = pairsSalidaEnDia.filter((p) => tiempoYmdEnAr(p.entrada.tiempo) === requestedDay);
    const pairsEntradaDiaAnterior = pairsSalidaEnDia.filter(
      (p) => tiempoYmdEnAr(p.entrada.tiempo) !== requestedDay,
    );
    const pairsSalidaDiaSiguiente = allPairs.filter(
      (p) =>
        tiempoYmdEnAr(p.entrada.tiempo) === requestedDay &&
        tiempoYmdEnAr(p.salida.tiempo) !== requestedDay,
    );
    const orphanEntradas = allOrphanEntradas.filter((f) => tiempoYmdEnAr(f.tiempo) === requestedDay);
    const orphanSalidas = allOrphanSalidas.filter((f) => tiempoYmdEnAr(f.tiempo) === requestedDay);

    if (
      pairs.length === 0 &&
      pairsEntradaDiaAnterior.length === 0 &&
      pairsSalidaDiaSiguiente.length === 0 &&
      orphanEntradas.length === 0 &&
      orphanSalidas.length === 0
    ) {
      continue;
    }

    let totalMs = 0;
    for (const p of [...pairs, ...pairsEntradaDiaAnterior]) {
      totalMs += p.ms;
    }

    const fichajesMap = new Map<string, FichajeAsistencia>();
    for (const p of [...pairs, ...pairsEntradaDiaAnterior, ...pairsSalidaDiaSiguiente]) {
      fichajesMap.set(p.entrada.id, p.entrada);
      fichajesMap.set(p.salida.id, p.salida);
    }
    for (const f of orphanEntradas) fichajesMap.set(f.id, f);
    for (const f of orphanSalidas) fichajesMap.set(f.id, f);
    const fichajes = [...fichajesMap.values()].sort((a, b) => msOf(a) - msOf(b));

    aggs.push({
      key,
      fichajes,
      pairs,
      pairsEntradaDiaAnterior,
      pairsSalidaDiaSiguiente,
      orphanEntradas,
      orphanSalidas,
      totalMs,
    });
  }

  aggs.sort((a, b) => {
    const t = (x: EmployeeDayAgg) => {
      let max = 0;
      for (const f of x.fichajes) {
        const v = msOf(f);
        if (v > max) max = v;
      }
      return max;
    };
    return t(b) - t(a);
  });

  return aggs;
}

function employeeDisplayLabel(agg: EmployeeDayAgg): string {
  const withEmp = agg.fichajes.find((f) => f.empleado);
  if (withEmp?.empleado) {
    return `${withEmp.empleado.firstName} ${withEmp.empleado.lastName}`;
  }
  return 'Sin empleado asociado';
}

function plantasLabel(agg: EmployeeDayAgg): string {
  const set = new Set<string>();
  for (const f of agg.fichajes) {
    if (f.planta) set.add(f.planta);
  }
  if (set.size === 0) return '—';
  return [...set].join(', ');
}

function monthlyDayHeader(fecha: string): string {
  return fecha.slice(-2);
}

function monthlyCellTone(day: MonthlyAttendanceDay): 'warning' | 'success' | 'danger' | 'info' | 'muted' | 'empty' {
  if (day.hasIncompletePunches) return 'warning';
  if (day.workedMs > 0 && day.balanceMs >= 0) return 'success';
  if (day.workedMs > 0) return 'danger';
  if (day.isJustifiedAbsence) return 'info';
  if (day.isNoLaborable) return 'muted';
  if (day.isUnjustifiedAbsence) return 'danger';
  return 'empty';
}

function monthlyCellClass(day: MonthlyAttendanceDay): string {
  switch (monthlyCellTone(day)) {
    case 'warning':
      return 'border border-amber-300 bg-amber-100 text-amber-950 ring-1 ring-amber-400/40 dark:border-amber-400/60 dark:bg-amber-400/20 dark:text-amber-50 dark:ring-amber-300/30';
    case 'success':
      return 'border border-emerald-200 bg-emerald-100 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-400/20 dark:text-emerald-50';
    case 'danger':
      return 'border border-red-200 bg-red-100 text-red-950 dark:border-red-400/50 dark:bg-red-400/20 dark:text-red-50';
    case 'info':
      return 'border border-blue-200 bg-blue-100 text-blue-950 dark:border-blue-400/50 dark:bg-blue-400/20 dark:text-blue-50';
    case 'muted':
      return 'border border-border bg-muted/60 text-muted-foreground dark:bg-slate-800/70 dark:text-slate-300';
    case 'empty':
      return 'border border-border bg-background text-muted-foreground dark:bg-slate-950 dark:text-slate-400';
  }
}

function monthlyCellTitle(day: MonthlyAttendanceDay): string {
  const pairDetails = day.pairDetails ?? [];
  const orphanEntradaDetails = day.orphanEntradaDetails ?? [];
  const orphanSalidaDetails = day.orphanSalidaDetails ?? [];
  const parts = [
    day.fecha,
    `Trabajado: ${formatDuracion(day.workedMs)}`,
    `Esperado: ${formatDuracion(day.expectedMs)}`,
  ];
  if (pairDetails.length === 1) {
    parts.push(`Entrada: ${formatSoloHora(pairDetails[0].entrada.tiempo)}`);
    parts.push(`Salida: ${formatSoloHora(pairDetails[0].salida.tiempo)}`);
  } else if (pairDetails.length > 1) {
    parts.push(`Tramos: ${pairDetails.map((pair) => `${formatSoloHora(pair.entrada.tiempo)}-${formatSoloHora(pair.salida.tiempo)}`).join(', ')}`);
  }
  if (orphanEntradaDetails.length > 0) parts.push(`${orphanEntradaDetails.length} entrada(s) sin salida`);
  if (orphanSalidaDetails.length > 0) parts.push(`${orphanSalidaDetails.length} salida(s) sin entrada`);
  return parts.join(' · ');
}

function monthlyCellPunchSummary(day: MonthlyAttendanceDay): { label: string; detail: string } | null {
  const pairDetails = day.pairDetails ?? [];
  if (pairDetails.length === 0) return null;
  if (pairDetails.length === 1) {
    return {
      label: `${formatSoloHora(pairDetails[0].entrada.tiempo)} / ${formatSoloHora(pairDetails[0].salida.tiempo)}`,
      detail: '1 tramo',
    };
  }
  const visiblePairs = pairDetails
    .slice(0, 2)
    .map((pair) => `${formatSoloHora(pair.entrada.tiempo)}-${formatSoloHora(pair.salida.tiempo)}`)
    .join(' · ');
  return {
    label: visiblePairs,
    detail: `${pairDetails.length} tramos${pairDetails.length > 2 ? ` (+${pairDetails.length - 2})` : ''}`,
  };
}

function monthlyCellExportText(day: MonthlyAttendanceDay): string {
  const punchSummary = monthlyCellPunchSummary(day);
  const lines = [day.workedMs > 0 ? formatDuracion(day.workedMs) : '—'];
  if (punchSummary) {
    lines.push(punchSummary.label);
    lines.push(punchSummary.detail);
  }
  if (day.hasIncompletePunches) {
    lines.push(`Inc. ${day.orphanEntradas + day.orphanSalidas}`);
  }
  return lines.join('\n');
}


export function RrhhPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = location.pathname.endsWith('/reportes')
    ? 'reportes'
    : location.pathname.endsWith('/mensual')
    ? 'mensual'
    : location.pathname.endsWith('/indicadores')
    ? 'indicadores'
    : location.pathname.endsWith('/pines')
    ? 'pines'
    : location.pathname.endsWith('/empleados')
    ? 'empleados'
    : 'general';
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [items, setItems] = useState<FichajeAsistencia[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoAsistencia[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [diaFecha, setDiaFecha] = useState(todayYmdAr);
  const [total, setTotal] = useState(0);
  const [pin, setPin] = useState('');
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState<EstadoOption>('');
  const [selectedPlanta, setSelectedPlanta] = useState<Planta>(DEFAULT_PLANTA);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [editHorariosOpen, setEditHorariosOpen] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditRowDraft>>({});
  const [reportEmpleadoId, setReportEmpleadoId] = useState('');
  const [reportDesde, setReportDesde] = useState(() => addDaysYmdAr(todayYmdAr(), -30));
  const [reportHasta, setReportHasta] = useState(todayYmdAr);
  const [reportHorasEsperadas, setReportHorasEsperadas] = useState(String(DEFAULT_HORAS_POR_PLANTA[DEFAULT_PLANTA]));
  // Si el usuario tocó manualmente el input, no lo pisamos al cambiar de empleado.
  const [reportHsTouched, setReportHsTouched] = useState(false);
  const [reportData, setReportData] = useState<ReporteEmpleadoRango | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'today' | 'other' | 'range'>('today');
  const [exportOtherDate, setExportOtherDate] = useState(todayYmdAr);
  const [exportDesde, setExportDesde] = useState(todayYmdAr);
  const [exportHasta, setExportHasta] = useState(todayYmdAr);
  const [exportLoading, setExportLoading] = useState(false);
  const [calendarioOpen, setCalendarioOpen] = useState(false);
  const [pines, setPines] = useState<PinSummaryRow[]>([]);
  const [pinesLoading, setPinesLoading] = useState(false);
  const [crearEmpleadoPin, setCrearEmpleadoPin] = useState<PinSummaryRow | null>(null);
  const [crearForm, setCrearForm] = useState({ firstName: '', lastName: '', dni: '' });
  const [savingCrear, setSavingCrear] = useState(false);
  const [asignandoKey, setAsignandoKey] = useState<string | null>(null);
  const [todosEmpleados, setTodosEmpleados] = useState<EmpleadoAsistencia[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editEmpDraft, setEditEmpDraft] = useState<UpdateEmpleadoPayload & { firstName: string; lastName: string; pin: string; planta: Planta }>({ firstName: '', lastName: '', pin: '', planta: DEFAULT_PLANTA });
  const [savingEmpId, setSavingEmpId] = useState<string | null>(null);
  const [nuevoEmpOpen, setNuevoEmpOpen] = useState(false);
  const [nuevoEmpForm, setNuevoEmpForm] = useState<{ firstName: string; lastName: string; pin: string; planta: Planta; dni: string; horasEsperadasDia: string }>({ firstName: '', lastName: '', pin: '', planta: DEFAULT_PLANTA, dni: '', horasEsperadasDia: '' });
  const [savingNuevo, setSavingNuevo] = useState(false);
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonthAr);
  const [monthlyViewMode, setMonthlyViewMode] = useState<'resumen' | 'matriz'>('resumen');
  const [monthlyData, setMonthlyData] = useState<MonthlyAttendanceSummary | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyExportLoading, setMonthlyExportLoading] = useState(false);
  const [kpisData, setKpisData] = useState<AttendanceKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [reportFixOpen, setReportFixOpen] = useState(false);
  const [reportFixTitle, setReportFixTitle] = useState('');
  const [reportFixSaving, setReportFixSaving] = useState(false);
  const [dayExceptionOpen, setDayExceptionOpen] = useState(false);
  const [dayExceptionLoading, setDayExceptionLoading] = useState(false);
  const [dayExceptionSaving, setDayExceptionSaving] = useState(false);
  const [dayExceptionExistingId, setDayExceptionExistingId] = useState<string | null>(null);
  const [dayExceptionForm, setDayExceptionForm] = useState<DayExceptionForm>({
    fecha: '',
    tipo: 'licencia_medica',
    horasJustificadas: '',
    motivo: '',
  });
  const [manualFichajeEmp, setManualFichajeEmp] = useState<{ id: string; pin: string; planta: Planta; firstName: string; lastName: string } | null>(null);
  const [manualFichajeDate, setManualFichajeDate] = useState('');
  const [manualFichajeRows, setManualFichajeRows] = useState<ManualFichajeRow[]>([]);
  const [manualFichajeSaving, setManualFichajeSaving] = useState(false);

  const [pendingReportAutoLoad, setPendingReportAutoLoad] = useState(false);

  // Cache de empleados (activos) y pines por planta. Se invalida en CRUD de empleados
  // y al reasignar/reconciliar pines. Evita re-fetch al togglear planta.
  const empleadosCacheRef = useRef<Map<Planta, EmpleadoAsistencia[]>>(new Map());
  const pinesCacheRef = useRef<Map<Planta, PinSummaryRow[]>>(new Map());

  const invalidateEmpleadosCache = () => {
    empleadosCacheRef.current.clear();
  };
  const invalidatePinesCache = () => {
    pinesCacheRef.current.clear();
  };

  const fetchEmpleadosCached = async (planta: Planta): Promise<EmpleadoAsistencia[]> => {
    const cached = empleadosCacheRef.current.get(planta);
    if (cached) return cached;
    const data = await asistenciaApi.getEmpleados(planta);
    empleadosCacheRef.current.set(planta, data);
    return data;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fichajesPage, empleadosData] = await Promise.all([
        asistenciaApi.getFichajes({
          fecha: diaFecha,
          pin: pin || undefined,
          nombre: nombre.trim() || undefined,
          estado,
          planta: selectedPlanta,
        }),
        fetchEmpleadosCached(selectedPlanta),
      ]);
      setItems(fichajesPage.items);
      setTotal(fichajesPage.total);
      setEmpleados(empleadosData);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadReportEmployees = async () => {
    try {
      setEmpleados(await fetchEmpleadosCached(selectedPlanta));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const loadMonthlySummary = async () => {
    setMonthlyLoading(true);
    try {
      setMonthlyData(await asistenciaApi.getMonthlySummary({ month: monthlyMonth, planta: selectedPlanta }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMonthlyLoading(false);
    }
  };

  const loadKpis = async () => {
    setKpisLoading(true);
    try {
      setKpisData(await asistenciaApi.getKpis({ month: monthlyMonth, planta: selectedPlanta }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setKpisLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'general') {
      void loadData();
    } else if (activeView === 'mensual') {
      void loadMonthlySummary();
    } else if (activeView === 'indicadores') {
      void loadKpis();
    } else if (activeView === 'pines') {
      void loadPines();
    } else if (activeView === 'empleados') {
      void loadTodosEmpleados();
    } else {
      void loadReportEmployees();
    }
  }, [activeView, diaFecha, estado, selectedPlanta, monthlyMonth]);

  useEffect(() => {
    if (!reportEmpleadoId) return;
    const emp = empleados.find((e) => e.id === reportEmpleadoId);
    if (emp && emp.planta !== selectedPlanta) {
      setReportEmpleadoId('');
      setReportData(null);
    }
  }, [selectedPlanta, empleados, reportEmpleadoId]);

  // Prefill del input "Hs/día" según el empleado seleccionado.
  // Si el usuario ya tocó el input manualmente, lo respetamos.
  useEffect(() => {
    if (reportHsTouched) return;
    const emp = empleados.find((e) => e.id === reportEmpleadoId);
    const hs = emp
      ? resolveHorasEsperadasDia({ planta: emp.planta, horasEsperadasDia: emp.horasEsperadasDia })
      : DEFAULT_HORAS_POR_PLANTA[selectedPlanta];
    setReportHorasEsperadas(String(hs));
  }, [reportEmpleadoId, empleados, selectedPlanta, reportHsTouched]);

  const onRefresh = async () => {
    // Botón "Refrescar": forzamos refetch de empleados también, por si alguien
    // los cambió en otra pestaña/ventana.
    invalidateEmpleadosCache();
    invalidatePinesCache();
    await loadData();
  };

  const loadPines = async () => {
    setPinesLoading(true);
    try {
      const cachedPines = pinesCacheRef.current.get(selectedPlanta);
      const pinesPromise = cachedPines
        ? Promise.resolve(cachedPines)
        : asistenciaApi.getPinesSummary(selectedPlanta).then((data) => {
            pinesCacheRef.current.set(selectedPlanta, data);
            return data;
          });
      const [data, emps] = await Promise.all([
        pinesPromise,
        fetchEmpleadosCached(selectedPlanta),
      ]);
      setPines(data);
      setEmpleados(emps);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPinesLoading(false);
    }
  };

  const asignarEmpleadoAPin = async (row: PinSummaryRow, empleadoId: string | null) => {
    const key = `${row.pin}:${row.planta}`;
    setAsignandoKey(key);
    try {
      const { updated } = await asistenciaApi.reassignPin(row.pin, row.planta, empleadoId);
      toast.success(
        empleadoId
          ? `Empleado asignado a ${updated} fichaje(s) del PIN`
          : `${updated} fichaje(s) quedaron sin empleado`,
      );
      invalidatePinesCache();
      await loadPines();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAsignandoKey(null);
    }
  };

  const crearEmpleadoDesdePin = async () => {
    if (!crearEmpleadoPin) return;
    if (!crearForm.firstName.trim() || !crearForm.lastName.trim()) {
      toast.error('Nombre y apellido son obligatorios');
      return;
    }
    setSavingCrear(true);
    try {
      // El backend autoasocia fichajes huérfanos con el mismo (pin, planta) al crear.
      await asistenciaApi.createEmpleado({
        firstName: crearForm.firstName.trim(),
        lastName: crearForm.lastName.trim(),
        pin: crearEmpleadoPin.pin,
        planta: crearEmpleadoPin.planta,
        dni: crearForm.dni.trim() || undefined,
        activo: true,
      });
      toast.success('Empleado creado y fichajes asociados');
      setCrearEmpleadoPin(null);
      setCrearForm({ firstName: '', lastName: '', dni: '' });
      invalidateEmpleadosCache();
      invalidatePinesCache();
      await loadPines();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingCrear(false);
    }
  };

  const empleadosByPlanta = useMemo(() => {
    const map = new Map<string, EmpleadoAsistencia[]>();
    for (const emp of empleados) {
      if (!emp.planta) continue;
      const arr = map.get(emp.planta) ?? [];
      arr.push(emp);
      map.set(emp.planta, arr);
    }
    return map;
  }, [empleados]);

  const itemsMismoDiaAr = useMemo(
    () => items.filter((f) => tiempoYmdEnAr(f.tiempo) === diaFecha),
    [items, diaFecha],
  );

  const aggregates = useMemo(
    () => buildEmployeeDayAggregates(items, diaFecha),
    [items, diaFecha],
  );

  const absentEmpleados = useMemo(() => {
    if (pin.trim() || nombre.trim()) return [];
    const presentEmpIds = new Set<string>();
    for (const agg of aggregates) {
      for (const f of agg.fichajes) {
        if (f.empleadoId) presentEmpIds.add(f.empleadoId);
      }
    }
    return empleados.filter((emp) => !presentEmpIds.has(emp.id));
  }, [aggregates, empleados, pin, nombre]);

  const reportExpectedHoursNum = Math.max(0, Number(reportHorasEsperadas) || 0);

  const hasReport = reportData !== null;

  const draftFor = (row: FichajeAsistencia): RowDraft => {
    const existing = drafts[row.id];
    if (existing) return existing;
    return {
      estado: String(row.estado) as EstadoOption,
      empleadoId: row.empleadoId ?? '',
    };
  };

  const updateDraft = (id: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } as RowDraft }));
  };

  const saveRow = async (row: FichajeAsistencia) => {
    const draft = draftFor(row);
    setSavingId(row.id);
    try {
      await asistenciaApi.updateFichaje(row.id, {
        estado: Number(draft.estado) as 0 | 1,
        empleadoId: draft.empleadoId || undefined,
      });
      toast.success('Fichaje actualizado');
      await loadData();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const loadTodosEmpleados = async () => {
    setEmpLoading(true);
    try {
      setTodosEmpleados(await asistenciaApi.getAllEmpleados(selectedPlanta));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setEmpLoading(false);
    }
  };

  const startEditEmp = (emp: EmpleadoAsistencia) => {
    setEditingEmpId(emp.id);
    setEditEmpDraft({ firstName: emp.firstName, lastName: emp.lastName, pin: emp.pin, planta: emp.planta, dni: emp.dni ?? '', activo: emp.activo, horasEsperadasDia: emp.horasEsperadasDia });
  };

  const saveEditEmp = async (id: string) => {
    setSavingEmpId(id);
    try {
      const updated = await asistenciaApi.updateEmpleado(id, editEmpDraft);
      setTodosEmpleados((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingEmpId(null);
      invalidateEmpleadosCache();
      toast.success('Empleado actualizado');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingEmpId(null);
    }
  };

  const deleteEmp = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await asistenciaApi.deleteEmpleado(id);
      setTodosEmpleados((prev) => prev.filter((e) => e.id !== id));
      invalidateEmpleadosCache();
      toast.success('Empleado eliminado');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const crearNuevoEmpleado = async () => {
    if (!nuevoEmpForm.firstName.trim() || !nuevoEmpForm.lastName.trim() || !nuevoEmpForm.pin.trim()) {
      toast.error('Nombre, apellido y PIN son obligatorios');
      return;
    }
    setSavingNuevo(true);
    try {
      const overrideStr = nuevoEmpForm.horasEsperadasDia.trim();
      const overrideNum = overrideStr === '' ? null : Number(overrideStr);
      if (overrideStr !== '' && (!Number.isFinite(overrideNum!) || overrideNum! < 0 || overrideNum! > 24)) {
        toast.error('Horas/día inválidas (0–24)');
        setSavingNuevo(false);
        return;
      }
      const created = await asistenciaApi.createEmpleado({
        firstName: nuevoEmpForm.firstName.trim(),
        lastName: nuevoEmpForm.lastName.trim(),
        pin: nuevoEmpForm.pin.trim(),
        planta: nuevoEmpForm.planta,
        dni: nuevoEmpForm.dni.trim() || undefined,
        activo: true,
        horasEsperadasDia: overrideNum,
      });
      setTodosEmpleados((prev) => [...prev, created].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      setNuevoEmpOpen(false);
      setNuevoEmpForm({ firstName: '', lastName: '', pin: '', planta: selectedPlanta, dni: '', horasEsperadasDia: '' });
      invalidateEmpleadosCache();
      toast.success('Empleado creado');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingNuevo(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const unmatched = itemsMismoDiaAr.filter((f) => !f.empleadoId).length;
  const hoyYmd = todayYmdAr();
  const puedeDiaSiguiente = diaFecha < hoyYmd;

  const applySearch = () => {
    void loadData();
  };

  const loadEmployeeReport = async (options?: { silent?: boolean }) => {
    if (!reportEmpleadoId) {
      toast.error('Seleccioná un empleado para generar el reporte');
      return;
    }
    if (!reportDesde || !reportHasta || reportDesde > reportHasta) {
      toast.error('Revisá el rango de fechas del reporte');
      return;
    }

    setReportLoading(true);
    try {
      const data = await asistenciaApi.getReporteEmpleado(reportEmpleadoId, {
        desde: reportDesde,
        hasta: reportHasta,
        horasEsperadasPorDia: reportHsTouched ? reportExpectedHoursNum : undefined,
      });
      setReportHorasEsperadas(String(data.horasEsperadasPorDia));
      setReportData(data);
      if (!options?.silent) toast.success(`Reporte generado: ${data.dias.length} día(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReportLoading(false);
    }
  };

  const openEmployeeMonthlyReport = (params: { empleadoId: string; planta: Planta; fecha?: string }) => {
    const range = params.fecha
      ? { desde: params.fecha, hasta: params.fecha }
      : monthRangeFromMonth(monthlyMonth);
    setSelectedPlanta(params.planta);
    setReportEmpleadoId(params.empleadoId);
    setReportDesde(range.desde);
    setReportHasta(range.hasta);
    setReportHsTouched(false);
    setReportData(null);
    setPendingReportAutoLoad(true);
    navigate('/rrhh/reportes');
  };

  useEffect(() => {
    if (!pendingReportAutoLoad || activeView !== 'reportes' || !reportEmpleadoId) return;
    setPendingReportAutoLoad(false);
    void loadEmployeeReport();
  }, [pendingReportAutoLoad, activeView, reportEmpleadoId, reportDesde, reportHasta, reportHorasEsperadas]);

  const exportEmployeeReportExcel = () => {
    if (!reportData) {
      toast.error('Generá un reporte antes de exportar');
      return;
    }

    const employeeName = `${reportData.empleado.firstName} ${reportData.empleado.lastName}`;
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      ['Reporte de asistencia'],
      ['Empleado', employeeName],
      ['PIN', reportData.empleado.pin],
      ['Planta', reportData.empleado.planta],
      ['Desde', reportData.desde],
      ['Hasta', reportData.hasta],
      ['Horas esperadas por día hábil', reportData.horasEsperadasPorDia],
      [],
      ['Días hábiles', reportData.resumen.diasHabiles],
      ['Días con tramos', reportData.resumen.diasConTramos],
      ['Horas esperadas', reportData.resumen.esperadoMs / 3600000],
      ['Horas trabajadas', reportData.resumen.trabajadoMs / 3600000],
      ['Horas justificadas', (reportData.resumen.justificadoMs ?? 0) / 3600000],
      ['Saldo', reportData.resumen.saldoMs / 3600000],
      ['Saldo legible', formatSaldoJornada(reportData.resumen.saldoMs)],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

    const detailRows = reportData.dias.map((day) => {
      const tramos = day.tramos
        .map((p) => `${formatSoloHora(p.entrada.tiempo)} - ${formatSoloHora(p.salida.tiempo)} (${formatDuracion(p.ms)})`)
        .join(' | ');
      const observaciones = [
        ...day.entradasSinSalida.map((f) => unmatchedFichajeText(f, reportData.empleado.planta)),
        ...day.salidasSinEntrada.map((f) => unmatchedFichajeText(f, reportData.empleado.planta)),
      ].join(' | ');
      return {
        Fecha: day.fecha,
        Día: formatDayHeading(day.fecha),
        'Día hábil': day.diaHabil ? 'Sí' : 'No',
        'Horas debidas': day.esperadoMs / 3600000,
        'Horas trabajadas': day.trabajadoMs / 3600000,
        'Horas justificadas': day.justificadoMs / 3600000,
        'Saldo horas': day.saldoMs / 3600000,
        'Saldo legible': formatSaldoJornada(day.saldoMs),
        Tramos: tramos || '-',
        Observaciones: observaciones || '-',
      };
    });
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet['!cols'] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 42 },
      { wch: 42 },
    ];
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle');

    XLSX.writeFile(
      workbook,
      `reporte-asistencia-${employeeName.replace(/\s+/g, '-')}-${reportData.desde}-${reportData.hasta}.xlsx`,
    );
  };

  const exportMonthlyMatrixExcel = async () => {
    if (!monthlyData) {
      toast.error('Cargá el acumulado mensual antes de exportar');
      return;
    }
    if (monthlyData.employees.length === 0) {
      toast.error('No hay empleados para exportar');
      return;
    }

    setMonthlyExportLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Lince RRHH';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Matriz diaria');
      ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

      const COLOR_HEADER_BG = 'FF1F2937';
      const COLOR_HEADER_FG = 'FFFFFFFF';
      const COLOR_BORDER = 'FFD1D5DB';
      const toneColors: Record<ReturnType<typeof monthlyCellTone>, { bg: string; fg: string }> = {
        success: { bg: 'FFD9EAD3', fg: 'FF14532D' },
        warning: { bg: 'FFFFE599', fg: 'FF713F12' },
        danger: { bg: 'FFF4CCCC', fg: 'FF7F1D1D' },
        info: { bg: 'FFCFE2F3', fg: 'FF1E3A8A' },
        muted: { bg: 'FFE5E7EB', fg: 'FF4B5563' },
        empty: { bg: 'FFF9FAFB', fg: 'FF6B7280' },
      };

      const days = monthlyData.employees[0]?.days ?? [];
      const headerRow = ws.addRow([
        'Empleado',
        'PIN',
        ...days.map((day) => monthlyDayHeader(day.fecha)),
        'Total',
      ]);

      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
        cell.font = { bold: true, color: { argb: COLOR_HEADER_FG }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: COLOR_BORDER } } };
      });
      headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      for (const row of monthlyData.employees) {
        const dataRow = ws.addRow([
          row.nombre,
          row.pin,
          ...row.days.map(monthlyCellExportText),
          formatDuracion(row.workedMs),
        ]);
        dataRow.height = 46;

        dataRow.getCell(1).font = { bold: true, color: { argb: 'FF111827' }, size: 10 };
        dataRow.getCell(2).font = { color: { argb: 'FF374151' }, size: 10 };

        for (let index = 0; index < row.days.length; index += 1) {
          const day = row.days[index];
          const cell = dataRow.getCell(index + 3);
          const colors = toneColors[monthlyCellTone(day)];
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
          cell.font = { color: { argb: colors.fg }, size: 9, bold: day.workedMs > 0 || day.hasIncompletePunches };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = { bottom: { style: 'hair', color: { argb: COLOR_BORDER } }, right: { style: 'hair', color: { argb: COLOR_BORDER } } };
          cell.note = monthlyCellTitle(day);
        }

        const totalCell = dataRow.getCell(days.length + 3);
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        totalCell.font = { bold: true, color: { argb: 'FF0C4A6E' }, size: 10 };
        totalCell.alignment = { vertical: 'middle', horizontal: 'right' };

        dataRow.eachCell((cell, colNumber) => {
          if (colNumber <= 2) {
            cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center', wrapText: true };
            cell.border = { bottom: { style: 'hair', color: { argb: COLOR_BORDER } }, right: { style: 'hair', color: { argb: COLOR_BORDER } } };
          }
        });
      }

      ws.columns = [
        { width: 30 },
        { width: 10 },
        ...days.map(() => ({ width: 13 })),
        { width: 14 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matriz-asistencia-${monthlyData.planta}-${monthlyData.month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Matriz mensual exportada');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMonthlyExportLoading(false);
    }
  };

  const exportFichajesExcel = async () => {
    let fechas: string[] = [];
    if (exportMode === 'today') {
      fechas = [diaFecha];
    } else if (exportMode === 'other') {
      if (!exportOtherDate) { toast.error('Seleccioná una fecha'); return; }
      fechas = [exportOtherDate];
    } else {
      if (!exportDesde || !exportHasta || exportDesde > exportHasta) {
        toast.error('Revisá el rango de fechas'); return;
      }
      const cur = new Date(exportDesde + 'T12:00:00');
      const end = new Date(exportHasta + 'T12:00:00');
      while (cur <= end && fechas.length < 62) {
        fechas.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }

    setExportLoading(true);
    try {
      const [empleadosExport, dayData] = await Promise.all([
        asistenciaApi.getEmpleados(selectedPlanta),
        Promise.all(
          fechas.map(async (fecha) => {
            const page = await asistenciaApi.getFichajes({ fecha, planta: selectedPlanta });
            return { fecha, aggs: buildEmployeeDayAggregates(page.items, fecha) };
          }),
        ),
      ]);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Lince RRHH';
      workbook.created = new Date();

      const COLOR_GREEN_BG = 'FFD4EDDA';
      const COLOR_GREEN_FG = 'FF155724';
      const COLOR_RED_BG = 'FFF8D7DA';
      const COLOR_RED_FG = 'FF721C24';
      const COLOR_GRAY_BG = 'FFF5F5F5';
      const COLOR_GRAY_FG = 'FF6C757D';
      const COLOR_AMBER_BG = 'FFFFF3CD';
      const COLOR_AMBER_FG = 'FF856404';
      const COLOR_HEADER_BG = 'FF343A40';
      const COLOR_HEADER_FG = 'FFFFFFFF';

      for (const { fecha, aggs } of dayData) {
        const sheetName = fecha.length > 31 ? fecha.slice(0, 31) : fecha;
        const ws = workbook.addWorksheet(sheetName);

        ws.mergeCells('A1:F1');
        const titleCell = ws.getCell('A1');
        titleCell.value = `Fichajes · ${formatDayHeading(fecha)}`;
        titleCell.font = { bold: true, size: 13, color: { argb: 'FF212529' } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
        ws.getRow(1).height = 24;

        ws.addRow([]);

        const headerRow = ws.addRow([
          'Empleado', 'Planta', 'Tramos entrada→salida', 'Total del día', 'Saldo jornada', 'Observaciones',
        ]);
        headerRow.height = 20;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
          cell.font = { bold: true, color: { argb: COLOR_HEADER_FG }, size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF6C757D' } } };
        });

        for (const agg of aggs) {
          const tieneValidos = aggHasValidPairs(agg);
          const msJornada = jornadaMsForAgg(agg);
          const saldoMs = agg.totalMs - msJornada;

          const tramos = [
            ...agg.pairs.map(
              (p) => `${formatSoloHora(p.entrada.tiempo)} → ${formatSoloHora(p.salida.tiempo)} (${formatDuracion(p.ms)})`,
            ),
            ...agg.pairsEntradaDiaAnterior.map(
              (p) => `${formatSoloHora(p.entrada.tiempo)} → ${formatSoloHora(p.salida.tiempo)} (${formatDuracion(p.ms)})`,
            ),
          ].join('  |  ');

          const observaciones = [
            ...agg.pairsSalidaDiaSiguiente.map(
              (p) => `↗ Turno cruza al día siguiente: ${formatSoloHora(p.entrada.tiempo)} → ${formatSoloHora(p.salida.tiempo)} (total computado en el día de salida)`,
            ),
            ...agg.orphanEntradas.map((f) => unmatchedFichajeText(f, f.planta, true)),
            ...agg.orphanSalidas.map((f) => unmatchedFichajeText(f, f.planta, true)),
          ].join('  |  ');

          const totalLabel = tieneValidos ? formatDuracion(agg.totalMs) : '—';
          const saldoLabel = tieneValidos ? formatSaldoJornada(saldoMs) : '—';

          const dataRow = ws.addRow([
            employeeDisplayLabel(agg),
            plantasLabel(agg),
            tramos || '—',
            totalLabel,
            saldoLabel,
            observaciones || '',
          ]);

          let rowBgArgb: string;
          let rowFgArgb: string;
          if (!tieneValidos) {
            rowBgArgb = COLOR_GRAY_BG; rowFgArgb = COLOR_GRAY_FG;
          } else if (agg.totalMs >= msJornada) {
            rowBgArgb = COLOR_GREEN_BG; rowFgArgb = COLOR_GREEN_FG;
          } else {
            rowBgArgb = COLOR_RED_BG; rowFgArgb = COLOR_RED_FG;
          }

          dataRow.height = observaciones ? 30 : 20;
          dataRow.eachCell((cell, colNum) => {
            const isObsCol = colNum === 6;
            const bg = isObsCol && observaciones ? COLOR_AMBER_BG : rowBgArgb;
            const fg = isObsCol && observaciones ? COLOR_AMBER_FG : rowFgArgb;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.font = { color: { argb: fg }, size: 10 };
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
          });
          dataRow.getCell(1).font = { bold: true, color: { argb: rowFgArgb }, size: 10 };
        }

        if (aggs.length === 0) {
          const emptyRow = ws.addRow(['Sin fichajes para este día']);
          emptyRow.getCell(1).font = { italic: true, color: { argb: COLOR_GRAY_FG } };
        }

        const presentEmpIdsExport = new Set<string>();
        for (const agg of aggs) {
          for (const f of agg.fichajes) {
            if (f.empleadoId) presentEmpIdsExport.add(f.empleadoId);
          }
        }
        for (const emp of empleadosExport.filter((e) => !presentEmpIdsExport.has(e.id))) {
          const dataRow = ws.addRow([
            `${emp.firstName} ${emp.lastName}`,
            plantaDisplayName(emp.planta),
            '—',
            '—',
            '—',
            'AUSENTE',
          ]);
          dataRow.height = 20;
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_RED_BG } };
            cell.font = { color: { argb: COLOR_RED_FG }, size: 10 };
            cell.alignment = { vertical: 'middle' };
            cell.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
          });
          dataRow.getCell(1).font = { bold: true, color: { argb: COLOR_RED_FG }, size: 10 };
        }

        ws.columns = [
          { key: 'empleado', width: 28 },
          { key: 'planta', width: 14 },
          { key: 'tramos', width: 48 },
          { key: 'total', width: 14 },
          { key: 'saldo', width: 14 },
          { key: 'obs', width: 38 },
        ];
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = fechas.length === 1 ? fechas[0] : `${fechas[0]}_${fechas[fechas.length - 1]}`;
      a.download = `fichajes-${suffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDialogOpen(false);
      toast.success(`Excel exportado: ${fechas.length} día(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportLoading(false);
    }
  };

  const openEditHorariosModal = () => {
    const next: Record<string, EditRowDraft> = {};
    for (const f of items) {
      const fecha = tiempoYmdEnAr(f.tiempo);
      const hora = tiempoHmsEnAr(f.tiempo);
      next[f.id] = {
        fichajeId: f.id,
        isNew: false,
        pin: f.pin,
        planta: f.planta,
        empleadoId: f.empleadoId ?? null,
        estado: f.estado,
        fecha,
        hora,
        saving: false,
        originalEstado: f.estado,
        originalFecha: fecha,
        originalHora: hora,
      };
    }
    setEditDrafts(next);
    setEditHorariosOpen(true);
  };

  const newManualRow = (estado: 0 | 1, hora: string, fecha: string): ManualFichajeRow => ({
    id: `mf-${Math.random().toString(36).slice(2)}`,
    estado,
    fecha,
    hora,
    saving: false,
  });

  const openManualFichajeModal = (
    emp: { id: string; pin: string; planta: Planta; firstName: string; lastName: string },
    fecha?: string,
  ) => {
    const date = fecha ?? diaFecha;
    setManualFichajeEmp(emp);
    setManualFichajeDate(date);
    setManualFichajeRows([newManualRow(0, '08:00:00', date)]);
  };

  const addManualRow = () => {
    setManualFichajeRows((prev) => {
      const lastEstado = prev[prev.length - 1]?.estado ?? 0;
      return [...prev, newManualRow(lastEstado === 0 ? 1 : 0, lastEstado === 0 ? '17:00:00' : '08:00:00', manualFichajeDate)];
    });
  };

  const updateManualRow = (id: string, patch: Partial<ManualFichajeRow>) => {
    setManualFichajeRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeManualRow = (id: string) => {
    setManualFichajeRows((prev) => prev.filter((r) => r.id !== id));
  };

  const saveManualFichajes = async () => {
    if (!manualFichajeEmp || manualFichajeRows.length === 0) return;
    setManualFichajeSaving(true);
    let saved = 0;
    let failed = 0;
    for (const row of manualFichajeRows) {
      try {
        const tiempo = arFechaYHoraToIso(row.fecha, row.hora);
        await asistenciaApi.createFichaje({
          pin: manualFichajeEmp.pin,
          planta: manualFichajeEmp.planta,
          estado: row.estado,
          tiempo,
          empleadoId: manualFichajeEmp.id,
        });
        saved++;
      } catch {
        failed++;
      }
    }
    setManualFichajeSaving(false);
    if (saved > 0) {
      toast.success(`${saved} fichaje${saved > 1 ? 's' : ''} guardado${saved > 1 ? 's' : ''}`);
      setManualFichajeEmp(null);
      setManualFichajeRows([]);
      await refreshAfterFichajeEdit();
    }
    if (failed > 0) toast.error(`${failed} fichaje${failed > 1 ? 's' : ''} no se pudo guardar`);
  };

  const openReportFixModal = (day: ReporteEmpleadoRango['dias'][number]) => {
    if (!reportData) return;
    const next: Record<string, EditRowDraft> = {};
    for (const f of day.fichajes) {
      const fecha = tiempoYmdEnAr(f.tiempo);
      const hora = tiempoHmsEnAr(f.tiempo);
      next[f.id] = {
        fichajeId: f.id,
        isNew: false,
        pin: reportData.empleado.pin,
        planta: reportData.empleado.planta,
        empleadoId: reportData.empleado.id,
        estado: f.estado,
        fecha,
        hora,
        saving: false,
        originalEstado: f.estado,
        originalFecha: fecha,
        originalHora: hora,
      };
    }
    setEditDrafts(next);
    setReportFixTitle(formatDayHeading(day.fecha));
    setReportFixOpen(true);
  };

  const openDayExceptionModal = async (day: ReporteEmpleadoRango['dias'][number]) => {
    if (!reportData) return;
    setDayExceptionOpen(true);
    setDayExceptionLoading(true);
    setDayExceptionExistingId(null);
    setDayExceptionForm({
      fecha: day.fecha,
      tipo: day.tipoAusencia ?? 'licencia_medica',
      horasJustificadas: day.justificadoMs > 0 ? String(day.justificadoMs / 3600000) : '',
      motivo: day.motivoNoLaborable ?? '',
    });
    try {
      const ausencias = await asistenciaCalendarApi.listAusencias({
        empleadoId: reportData.empleado.id,
        desde: day.fecha,
        hasta: day.fecha,
      });
      const exact = ausencias.find((a) => a.desde === day.fecha && a.hasta === day.fecha) ?? null;
      if (exact) {
        setDayExceptionExistingId(exact.id);
        setDayExceptionForm({
          fecha: day.fecha,
          tipo: exact.tipo,
          horasJustificadas: exact.horasJustificadas != null ? String(exact.horasJustificadas) : '',
          motivo: exact.motivo ?? '',
        });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDayExceptionLoading(false);
    }
  };

  const saveDayException = async () => {
    if (!reportData || !dayExceptionForm.fecha) return;
    const horasText = dayExceptionForm.horasJustificadas.trim();
    const horasJustificadas = horasText === '' ? null : Number(horasText);
    if (horasJustificadas !== null && (!Number.isFinite(horasJustificadas) || horasJustificadas < 0 || horasJustificadas > 24)) {
      toast.error('Las horas justificadas deben estar entre 0 y 24');
      return;
    }
    setDayExceptionSaving(true);
    try {
      const payload = {
        desde: dayExceptionForm.fecha,
        hasta: dayExceptionForm.fecha,
        tipo: dayExceptionForm.tipo,
        motivo: dayExceptionForm.motivo.trim() || null,
        horasJustificadas,
      };
      if (dayExceptionExistingId) {
        await asistenciaCalendarApi.updateAusencia(dayExceptionExistingId, payload);
      } else {
        await asistenciaCalendarApi.createAusencia({
          empleadoId: reportData.empleado.id,
          ...payload,
        });
      }
      toast.success('Excepción guardada');
      setDayExceptionOpen(false);
      await loadEmployeeReport({ silent: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDayExceptionSaving(false);
    }
  };

  const deleteDayException = async () => {
    if (!dayExceptionExistingId) return;
    setDayExceptionSaving(true);
    try {
      await asistenciaCalendarApi.deleteAusencia(dayExceptionExistingId);
      toast.success('Excepción eliminada');
      setDayExceptionOpen(false);
      await loadEmployeeReport({ silent: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDayExceptionSaving(false);
    }
  };

  const refreshAfterFichajeEdit = async () => {
    if (activeView === 'reportes') {
      await loadEmployeeReport({ silent: true });
      return;
    }

    const fichajesPage = await asistenciaApi.getFichajes({
      fecha: diaFecha,
      pin: pin || undefined,
      nombre: nombre.trim() || undefined,
      estado,
      planta: selectedPlanta,
    });
    setItems(fichajesPage.items);
    setTotal(fichajesPage.total);

    setEditDrafts((prev) => {
      const next: Record<string, EditRowDraft> = {};
      for (const f of fichajesPage.items) {
        const fecha = tiempoYmdEnAr(f.tiempo);
        const hora = tiempoHmsEnAr(f.tiempo);
        next[f.id] = {
          fichajeId: f.id,
          isNew: false,
          pin: f.pin,
          planta: f.planta,
          empleadoId: f.empleadoId ?? null,
          estado: f.estado,
          fecha,
          hora,
          saving: false,
          originalEstado: f.estado,
          originalFecha: fecha,
          originalHora: hora,
        };
      }
      for (const [key, d] of Object.entries(prev)) {
        if (d.isNew && key !== 'discarded') next[key] = d;
      }
      return next;
    });
  };

  const updatePatchForDraft = (draft: EditRowDraft): { tiempo?: string; estado?: 0 | 1 } => {
    const patch: { tiempo?: string; estado?: 0 | 1 } = {};
    const tiempo = arFechaYHoraToIso(draft.fecha, draft.hora);

    if (draft.originalFecha !== undefined && draft.originalHora !== undefined) {
      const originalTiempo = arFechaYHoraToIso(draft.originalFecha, draft.originalHora);
      if (new Date(tiempo).getTime() !== new Date(originalTiempo).getTime()) patch.tiempo = tiempo;
      if (draft.originalEstado !== undefined && draft.estado !== draft.originalEstado) patch.estado = draft.estado;
      return patch;
    }

    const orig = items.find((f) => f.id === draft.fichajeId);
    if (!orig) return patch;
    if (new Date(tiempo).getTime() !== new Date(orig.tiempo).getTime()) patch.tiempo = tiempo;
    if (draft.estado !== orig.estado) patch.estado = draft.estado;
    return patch;
  };

  const persistEditDraft = async (draft: EditRowDraft) => {
    const tiempo = arFechaYHoraToIso(draft.fecha, draft.hora);

    if (draft.isNew) {
      await asistenciaApi.createFichaje({
        pin: draft.pin,
        planta: draft.planta!,
        estado: draft.estado,
        tiempo,
        empleadoId: draft.empleadoId,
      });
      return true;
    }

    const patch = updatePatchForDraft(draft);
    if (Object.keys(patch).length === 0) return false;
    await asistenciaApi.updateFichaje(draft.fichajeId, patch);
    return true;
  };

  const saveEditRow = async (fichajeId: string) => {
    const draft = editDrafts[fichajeId];
    if (!draft) return;

    setEditDrafts((prev) => ({
      ...prev,
      [fichajeId]: { ...prev[fichajeId], saving: true },
    }));

    try {
      const changed = await persistEditDraft(draft);
      if (!changed) {
        toast.message('Sin cambios');
        setEditDrafts((prev) => ({ ...prev, [fichajeId]: { ...prev[fichajeId], saving: false } }));
        return;
      }

      toast.success('Guardado');
      await refreshAfterFichajeEdit();
    } catch (err) {
      toast.error((err as Error).message);
      setEditDrafts((prev) => ({
        ...prev,
        [fichajeId]: { ...prev[fichajeId], saving: false },
      }));
    }
  };

  const saveReportFixDrafts = async () => {
    const dirtyDrafts = Object.values(editDrafts)
      .filter(isEditRowDirty)
      .sort((a, b) => Number(a.isNew) - Number(b.isNew));

    if (dirtyDrafts.length === 0) {
      setReportFixOpen(false);
      return;
    }

    setReportFixSaving(true);
    setEditDrafts((prev) => {
      const next = { ...prev };
      for (const draft of dirtyDrafts) {
        next[draft.fichajeId] = { ...next[draft.fichajeId], saving: true };
      }
      return next;
    });

    try {
      let saved = 0;
      for (const draft of dirtyDrafts) {
        if (await persistEditDraft(draft)) saved += 1;
      }
      await loadEmployeeReport({ silent: true });
      setReportFixOpen(false);
      toast.success(`${saved} fichaje(s) guardado(s)`);
    } catch (err) {
      toast.error((err as Error).message);
      setEditDrafts((prev) => {
        const next = { ...prev };
        for (const draft of dirtyDrafts) {
          if (next[draft.fichajeId]) next[draft.fichajeId] = { ...next[draft.fichajeId], saving: false };
        }
        return next;
      });
    } finally {
      setReportFixSaving(false);
    }
  };

  const addComplementRow = (orphan: FichajeAsistencia) => {
    const complementEstado: 0 | 1 = orphan.estado === 0 ? 1 : 0;
    const orphanMs = new Date(orphan.tiempo).getTime();
    const jornadaHs = orphan.empleado
      ? resolveHorasEsperadasDia({
          planta: orphan.empleado.planta,
          horasEsperadasDia: orphan.empleado.horasEsperadasDia,
        })
      : 8;
    const jornadaMs = jornadaHs * 3600000;
    const delta = orphan.estado === 0 ? jornadaMs : -jornadaMs;
    const suggestedIso = new Date(orphanMs + delta).toISOString();
    const newId = `new-${Math.random().toString(36).slice(2)}`;
    setEditDrafts((prev) => ({
      ...prev,
      [newId]: {
        fichajeId: newId,
        isNew: true,
        pin: orphan.pin,
        planta: orphan.planta,
        empleadoId: orphan.empleadoId ?? null,
        estado: complementEstado,
        fecha: tiempoYmdEnAr(suggestedIso),
        hora: tiempoHmsEnAr(suggestedIso),
        saving: false,
        forOrphanId: orphan.id,
      },
    }));
  };

  const addReportComplementRow = (orphan: ReporteEmpleadoRango['dias'][number]['fichajes'][number]) => {
    if (!reportData) return;
    const complementEstado: 0 | 1 = orphan.estado === 0 ? 1 : 0;
    const orphanMs = new Date(orphan.tiempo).getTime();
    const jornadaMs = reportData.horasEsperadasPorDia * 3600000;
    const suggestedIso = new Date(orphanMs + (orphan.estado === 0 ? jornadaMs : -jornadaMs)).toISOString();
    const newId = `new-${Math.random().toString(36).slice(2)}`;
    setEditDrafts((prev) => ({
      ...prev,
      [newId]: {
        fichajeId: newId,
        isNew: true,
        pin: reportData.empleado.pin,
        planta: reportData.empleado.planta,
        empleadoId: reportData.empleado.id,
        estado: complementEstado,
        fecha: tiempoYmdEnAr(suggestedIso),
        hora: tiempoHmsEnAr(suggestedIso),
        saving: false,
        forOrphanId: orphan.id,
      },
    }));
  };

  const deleteEditRow = async (fichajeId: string) => {
    const draft = editDrafts[fichajeId];
    if (!draft) return;

    if (draft.isNew) {
      setEditDrafts((prev) => {
        const next = { ...prev };
        delete next[fichajeId];
        return next;
      });
      return;
    }

    setEditDrafts((prev) => ({
      ...prev,
      [fichajeId]: { ...prev[fichajeId], saving: true },
    }));

    try {
      await asistenciaApi.deleteFichaje(fichajeId);
      toast.success('Fichaje eliminado');
      if (activeView === 'reportes') {
        setEditDrafts((prev) => {
          const next = { ...prev };
          delete next[fichajeId];
          for (const [key, d] of Object.entries(next)) {
            if (d.forOrphanId === fichajeId) delete next[key];
          }
          return next;
        });
      }
      await refreshAfterFichajeEdit();
    } catch (err) {
      toast.error((err as Error).message);
      setEditDrafts((prev) => ({
        ...prev,
        [fichajeId]: { ...prev[fichajeId], saving: false },
      }));
    }
  };

  const isEditRowDirty = (draft: EditRowDraft): boolean => {
    if (draft.isNew) return true;
    if (draft.originalEstado !== undefined) {
      return (
        draft.estado !== draft.originalEstado ||
        draft.fecha !== draft.originalFecha ||
        draft.hora !== draft.originalHora
      );
    }
    const orig = items.find((f) => f.id === draft.fichajeId);
    if (!orig) return false;
    return (
      draft.estado !== orig.estado ||
      draft.fecha !== tiempoYmdEnAr(orig.tiempo) ||
      draft.hora !== tiempoHmsEnAr(orig.tiempo)
    );
  };

  const renderEditRow = (draft: EditRowDraft | undefined, label: string, options?: { showSave?: boolean }) => {
    if (!draft) return null;
    const dirty = isEditRowDirty(draft);
    const showSave = options?.showSave ?? true;
    const setDraft = (patch: Partial<EditRowDraft>) =>
      setEditDrafts((prev) => ({
        ...prev,
        [draft.fichajeId]: { ...prev[draft.fichajeId], ...patch },
      }));
    return (
      <div key={draft.fichajeId} className="flex items-center gap-2 py-1 flex-wrap">
        <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
        <select
          value={String(draft.estado)}
          onChange={(e) => setDraft({ estado: Number(e.target.value) as 0 | 1 })}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="0">Entrada</option>
          <option value="1">Salida</option>
        </select>
        <input
          type="date"
          value={draft.fecha}
          onChange={(e) => setDraft({ fecha: e.target.value })}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        />
        <input
          type="time"
          step={1}
          value={draft.hora}
          onChange={(e) => setDraft({ hora: e.target.value })}
          className="rounded border border-border bg-background px-2 py-1 text-xs tabular-nums"
        />
        {showSave && (
          <button
            type="button"
            onClick={() => void saveEditRow(draft.fichajeId)}
            disabled={draft.saving || !dirty}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
              dirty
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'invisible'
            }`}
          >
            {draft.saving ? '…' : 'Guardar'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void deleteEditRow(draft.fichajeId)}
          disabled={draft.saving}
          title={draft.isNew ? 'Descartar' : 'Eliminar fichaje'}
          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">RRHH</h1>
        {activeView === 'general' && (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={openEditHorariosModal}
            disabled={loading || aggregates.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50"
          >
            <Clock className="h-3.5 w-3.5" />
            Editar horarios
          </button>
          <button
            type="button"
            onClick={() => {
              setExportMode('today');
              setExportOtherDate(diaFecha);
              setExportDesde(diaFecha);
              setExportHasta(diaFecha);
              setExportDialogOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => setCalendarioOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendario laboral
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
        )}
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
        <NavLink
          to="/rrhh"
          end
          className={({ isActive }) =>
            [
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')
          }
        >
          Vista general
        </NavLink>
        <NavLink
          to="/rrhh/mensual"
          className={({ isActive }) =>
            [
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')
          }
        >
          Acumulado mensual
        </NavLink>
        <NavLink
          to="/rrhh/indicadores"
          className={({ isActive }) =>
            [
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')
          }
        >
          Indicadores
        </NavLink>
        <NavLink
          to="/rrhh/reportes"
          className={({ isActive }) =>
            [
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')
          }
        >
          Generar reporte
        </NavLink>
        <NavLink
          to="/rrhh/pines"
          className={({ isActive }) =>
            [
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')
          }
        >
          Registro de PINs
        </NavLink>
        <NavLink
          to="/rrhh/empleados"
          className={({ isActive }) =>
            [
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')
          }
        >
          Empleados
        </NavLink>
      </div>

      {activeView === 'general' && (
        <>
      <Dialog
        open={editHorariosOpen}
        onClose={() => setEditHorariosOpen(false)}
        title="Editar horarios de fichajes"
        description={`${formatDayHeading(diaFecha)} · hora Argentina (−03:00). Cada fila se guarda de forma independiente.`}
        panelClassName="sm:max-w-4xl"
      >
        <div className="max-h-[80vh] overflow-y-auto space-y-5 pr-1">
          {aggregates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sin fichajes para este día</p>
          )}
          {aggregates.map((agg) => {
            const firstF = agg.fichajes[0];
            const empPlanta = firstF?.planta ?? null;
            return (
              <div key={agg.key} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
                  {employeeDisplayLabel(agg)}
                  {empPlanta ? <span className="font-normal"> · {plantaDisplayName(empPlanta)}</span> : null}
                </h4>

                {agg.pairs.map((pair, i) => (
                  <div key={i} className="pl-3 border-l-2 border-blue-400/60 space-y-0.5">
                    <p className="text-xs text-blue-500 font-medium mb-1">Turno {i + 1}</p>
                    {renderEditRow(editDrafts[pair.entrada.id], 'Entrada')}
                    {renderEditRow(editDrafts[pair.salida.id], 'Salida')}
                  </div>
                ))}

                {agg.pairsSalidaDiaSiguiente.map((pair, i) => (
                  <div key={i} className="pl-3 border-l-2 border-sky-400/60 space-y-0.5">
                    <p className="text-xs text-sky-500 font-medium mb-1">🌙 Turno nocturno — salida al día siguiente</p>
                    {renderEditRow(editDrafts[pair.entrada.id], 'Entrada')}
                    {renderEditRow(editDrafts[pair.salida.id], 'Salida')}
                  </div>
                ))}

                {agg.pairsEntradaDiaAnterior.map((pair, i) => (
                  <div key={i} className="pl-3 border-l-2 border-sky-400/60 space-y-0.5">
                    <p className="text-xs text-sky-500 font-medium mb-1">🌙 Turno nocturno — entrada del día anterior</p>
                    {renderEditRow(editDrafts[pair.entrada.id], 'Entrada')}
                    {renderEditRow(editDrafts[pair.salida.id], 'Salida')}
                  </div>
                ))}

                {agg.orphanEntradas.map((f) => {
                  const hasComplement = Object.values(editDrafts).some((d) => d.forOrphanId === f.id);
                  return (
                    <div key={f.id} className="pl-3 border-l-2 border-amber-400/60 space-y-0.5">
                      <p className="text-xs text-amber-500 font-medium mb-1">⚠ {unmatchedFichajeHeading(f)}</p>
                      {renderEditRow(editDrafts[f.id], 'Entrada')}
                      {Object.values(editDrafts)
                        .filter((d) => d.forOrphanId === f.id)
                        .map((d) => renderEditRow(d, 'Salida (nueva)'))}
                      {!hasComplement && (
                        <button
                          type="button"
                          onClick={() => addComplementRow(f)}
                          className="mt-1 text-xs border border-dashed border-border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                        >
                          + Agregar Salida
                        </button>
                      )}
                    </div>
                  );
                })}

                {agg.orphanSalidas.map((f) => {
                  const hasComplement = Object.values(editDrafts).some((d) => d.forOrphanId === f.id);
                  return (
                    <div key={f.id} className="pl-3 border-l-2 border-amber-400/60 space-y-0.5">
                      <p className="text-xs text-amber-500 font-medium mb-1">⚠ {unmatchedFichajeHeading(f)}</p>
                      {renderEditRow(editDrafts[f.id], 'Salida')}
                      {Object.values(editDrafts)
                        .filter((d) => d.forOrphanId === f.id)
                        .map((d) => renderEditRow(d, 'Entrada (nueva)'))}
                      {!hasComplement && (
                        <button
                          type="button"
                          onClick={() => addComplementRow(f)}
                          className="mt-1 text-xs border border-dashed border-border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                        >
                          + Agregar Entrada
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-4 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={() => setEditHorariosOpen(false)}>
            Cerrar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={exportDialogOpen}
        onClose={() => !exportLoading && setExportDialogOpen(false)}
        title="Exportar Excel de fichajes"
        description="Elegí qué días incluir. Cada día se genera en una hoja separada."
        panelClassName="max-w-md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {(
              [
                { value: 'today', label: `Día actual (${formatDayHeading(diaFecha)})` },
                { value: 'other', label: 'Otro día' },
                { value: 'range', label: 'Rango de fechas (una hoja por día)' },
              ] as const
            ).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer rounded-lg border border-border px-4 py-3 hover:bg-accent">
                <input
                  type="radio"
                  name="exportMode"
                  value={value}
                  checked={exportMode === value}
                  onChange={() => setExportMode(value)}
                  className="accent-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          {exportMode === 'other' && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-muted-foreground">Fecha</label>
              <input
                type="date"
                value={exportOtherDate}
                max={hoyYmd}
                onChange={(e) => setExportOtherDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
          )}

          {exportMode === 'range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-muted-foreground">Desde</label>
              <input
                type="date"
                value={exportDesde}
                max={hoyYmd}
                onChange={(e) => setExportDesde(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
              <label className="text-sm text-muted-foreground">hasta</label>
              <input
                type="date"
                value={exportHasta}
                max={hoyYmd}
                onChange={(e) => setExportHasta(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
              {exportDesde && exportHasta && exportDesde <= exportHasta && (
                <p className="w-full text-xs text-muted-foreground">
                  {(() => {
                    const d1 = new Date(exportDesde + 'T12:00:00');
                    const d2 = new Date(exportHasta + 'T12:00:00');
                    const days = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
                    return `${days} día(s) · ${days} hoja(s) en el Excel`;
                  })()}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => setExportDialogOpen(false)}
            disabled={exportLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void exportFichajesExcel()}
            disabled={exportLoading}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            {exportLoading ? 'Generando…' : 'Exportar'}
          </Button>
        </div>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Registros del día</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{itemsMismoDiaAr.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sin empleado</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">{unmatched}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha (Argentina)</p>
          <p className="mt-1 text-base font-semibold capitalize leading-snug">{formatDayHeading(diaFecha)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border bg-card/50 p-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Día
          <input
            type="date"
            value={diaFecha}
            max={hoyYmd}
            onChange={(e) => setDiaFecha(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm w-24"
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre empleado"
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm min-w-[180px] flex-1 max-w-xs"
        />
        <button
          type="button"
          onClick={() => { applySearch(); }}
          className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background hover:bg-accent"
        >
          Buscar
        </button>
        <select
          value={estado}
          onChange={(e) => { setEstado(e.target.value as EstadoOption); }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Entrada y salida</option>
          <option value="0">Solo entradas</option>
          <option value="1">Solo salidas</option>
        </select>
        <PlantaToggle value={selectedPlanta} onChange={setSelectedPlanta} />
      </div>
        </>
      )}

      {activeView === 'mensual' && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border bg-card/50 p-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Mes
              <input
                type="month"
                value={monthlyMonth}
                max={currentMonthAr()}
                onChange={(e) => setMonthlyMonth(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <PlantaToggle value={selectedPlanta} onChange={setSelectedPlanta} />
            <button
              type="button"
              onClick={() => void loadMonthlySummary()}
              disabled={monthlyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${monthlyLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {monthlyData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dotación</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{monthlyData.totals.empleados}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cumplimiento</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPct(monthlyData.totals.cumplimientoPct)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ausentismo</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">{formatPct(monthlyData.totals.ausentismoPct)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo mensual</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${monthlyData.totals.balanceMs < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatSaldoJornada(monthlyData.totals.balanceMs)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fichajes a revisar</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">
                    {monthlyData.totals.diasConFichajeIncompleto + monthlyData.totals.fichajesSinEmpleado}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Acumulado del mes</h2>
                    <p className="text-xs text-muted-foreground">{monthlyData.desde} al {monthlyData.hasta} · {plantaDisplayName(monthlyData.planta)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void exportMonthlyMatrixExcel()}
                      disabled={monthlyExportLoading || monthlyData.employees.length === 0}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {monthlyExportLoading ? 'Exportando…' : 'Exportar matriz'}
                    </button>
                    <div className="inline-flex rounded-lg border border-border bg-background p-1">
                      <button
                        type="button"
                        onClick={() => setMonthlyViewMode('resumen')}
                        aria-pressed={monthlyViewMode === 'resumen'}
                        className={[
                          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          monthlyViewMode === 'resumen' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                      >
                        Resumen
                      </button>
                      <button
                        type="button"
                        onClick={() => setMonthlyViewMode('matriz')}
                        aria-pressed={monthlyViewMode === 'matriz'}
                        className={[
                          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          monthlyViewMode === 'matriz' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                      >
                        Matriz diaria
                      </button>
                    </div>
                  </div>
                </div>
                {monthlyViewMode === 'resumen' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left">Empleado</th>
                          <th className="px-4 py-3 text-right">Trabajado</th>
                          <th className="px-4 py-3 text-right">Esperado</th>
                          <th className="px-4 py-3 text-right">Saldo</th>
                          <th className="px-4 py-3 text-right">Cumpl.</th>
                          <th className="px-4 py-3 text-right">Aus.</th>
                          <th className="px-4 py-3 text-right">Inc.</th>
                          <th className="px-4 py-3 text-left">Estado</th>
                          <th className="px-4 py-3 text-right">Reporte</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {monthlyData.employees.map((row) => (
                          <tr key={row.empleadoId} className="hover:bg-muted/20">
                            <td className="px-4 py-3 min-w-[220px]">
                              <p className="font-medium text-foreground">{row.nombre}</p>
                              <p className="text-xs text-muted-foreground">PIN {row.pin} · {row.departamento || row.cargo || plantaDisplayName(row.planta)}</p>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatDuracion(row.workedMs)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatDuracion(row.expectedMs)}</td>
                            <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balanceMs < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatSaldoJornada(row.balanceMs)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatPct(row.cumplimientoPct)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{row.diasAusenteInjustificado}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{row.diasConFichajeIncompleto}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                                {statusLabel(row.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => openEmployeeMonthlyReport({ empleadoId: row.empleadoId, planta: row.planta })}
                                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                              >
                                Ver mes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {monthlyData.employees.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-muted-foreground">No hay empleados para mostrar en este período.</p>
                    ) : (
                    <table className="min-w-max border-separate border-spacing-1 bg-slate-100 p-1 text-xs dark:bg-slate-900/80">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="sticky left-0 z-20 rounded-md bg-slate-200 px-3 py-2 text-left min-w-[220px] text-slate-800 dark:bg-slate-800 dark:text-slate-100">Empleado</th>
                          {monthlyData.employees[0]?.days.map((day) => (
                            <th key={day.fecha} className="rounded-md bg-slate-200 px-1.5 py-2 text-center font-medium min-w-[76px] text-slate-700 dark:bg-slate-800 dark:text-slate-200" title={day.fecha}>
                              {monthlyDayHeader(day.fecha)}
                            </th>
                          ))}
                          <th className="rounded-md bg-slate-200 px-3 py-2 text-right min-w-[96px] text-slate-800 dark:bg-slate-800 dark:text-slate-100">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.employees.map((row) => (
                          <tr key={row.empleadoId}>
                            <td className="sticky left-0 z-10 rounded-md border border-border bg-card px-3 py-2 min-w-[220px] shadow-sm dark:bg-slate-950">
                              <p className="font-medium text-foreground">{row.nombre}</p>
                              <p className="text-[11px] text-muted-foreground">PIN {row.pin}</p>
                            </td>
                            {row.days.map((day) => {
                              const punchSummary = monthlyCellPunchSummary(day);
                              return (
                                <td key={day.fecha} className="p-1 align-top">
                                  <div
                                    title={monthlyCellTitle(day)}
                                    aria-label={monthlyCellTitle(day)}
                                    className={`min-h-[54px] rounded-md px-1.5 py-1 text-center tabular-nums ${monthlyCellClass(day)}`}
                                  >
                                    <p className="font-semibold leading-tight">{day.workedMs > 0 ? formatDuracion(day.workedMs) : '—'}</p>
                                    {punchSummary ? (
                                      <>
                                        <p className="mt-0.5 text-[10px] leading-tight opacity-80">{punchSummary.label}</p>
                                        <p className="mt-0.5 text-[10px] leading-tight opacity-70">{punchSummary.detail}</p>
                                      </>
                                    ) : null}
                                    {day.hasIncompletePunches ? (
                                      <p className="mt-0.5 text-[10px] font-medium leading-tight">Inc. {day.orphanEntradas + day.orphanSalidas}</p>
                                    ) : null}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="rounded-md border border-sky-200 bg-sky-100 px-3 py-2 text-right tabular-nums font-semibold text-sky-950 dark:border-sky-400/50 dark:bg-sky-400/20 dark:text-sky-50">{formatDuracion(row.workedMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {monthlyLoading && <p className="text-sm text-muted-foreground">Calculando acumulado mensual…</p>}
        </section>
      )}

      {activeView === 'indicadores' && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border bg-card/50 p-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Mes
              <input
                type="month"
                value={monthlyMonth}
                max={currentMonthAr()}
                onChange={(e) => setMonthlyMonth(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <PlantaToggle value={selectedPlanta} onChange={setSelectedPlanta} />
            <button
              type="button"
              onClick={() => void loadKpis()}
              disabled={kpisLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${kpisLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {kpisData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Presentismo</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{formatPct(kpisData.cards.presentismoPct)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cumplimiento horario</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPct(kpisData.cards.cumplimientoPct)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo neto</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${kpisData.cards.balanceMs < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatSaldoJornada(kpisData.cards.balanceMs)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calidad de datos</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">
                    {kpisData.cards.fichajesSinEmpleado + kpisData.cards.diasConFichajeIncompleto}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border bg-muted/30 px-4 py-3">
                    <h2 className="text-base font-semibold text-foreground">Personas a revisar</h2>
                    <p className="text-xs text-muted-foreground">Priorizado por ausencias, fichajes incompletos y saldo negativo.</p>
                  </div>
                  <div className="divide-y divide-border">
                    {kpisData.topReview.length === 0 && <p className="p-4 text-sm text-muted-foreground">No hay empleados en revisión para este período.</p>}
                    {kpisData.topReview.map((row) => (
                      <div key={row.empleadoId} className="p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{row.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.diasAusenteInjustificado} aus. · {row.diasConFichajeIncompleto} inc. · saldo {formatSaldoJornada(row.balanceMs)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEmployeeMonthlyReport({ empleadoId: row.empleadoId, planta: row.planta })}
                            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                          >
                            Ver reporte
                          </button>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="border-b border-border bg-muted/30 px-4 py-3">
                      <h2 className="text-base font-semibold text-foreground">Fichajes incompletos</h2>
                      <p className="text-xs text-muted-foreground">Entradas o salidas sin pareja detectadas en el mes. Abrí el día exacto para corregirlo.</p>
                    </div>
                    <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
                      {kpisData.incompletePunches.length === 0 && (
                        <p className="p-4 text-sm text-muted-foreground">No hay fichajes incompletos en este período.</p>
                      )}
                      {kpisData.incompletePunches.map((item) => (
                        <div key={`${item.empleadoId}-${item.fecha}-${item.orphanEntradas}-${item.orphanSalidas}`} className="p-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{item.empleadoNombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.fecha} · {item.orphanEntradas} entrada(s) sin salida · {item.orphanSalidas} salida(s) sin entrada
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEmployeeMonthlyReport({ empleadoId: item.empleadoId, planta: item.planta, fecha: item.fecha })}
                            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                          >
                            Corregir día
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="border-b border-border bg-muted/30 px-4 py-3">
                      <h2 className="text-base font-semibold text-foreground">Alertas accionables</h2>
                    </div>
                    <div className="p-4 space-y-3">
                      {kpisData.alerts.map((alert, i) => (
                        <div key={`${alert.title}-${i}`} className={`rounded-lg border p-3 ${alertClass(alert.severity)}`}>
                          <p className="text-sm font-semibold">{alert.title}</p>
                          <p className="text-xs mt-1 opacity-90">{alert.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="border-b border-border bg-muted/30 px-4 py-3">
                      <h2 className="text-base font-semibold text-foreground">Tendencia semanal</h2>
                    </div>
                    <div className="p-4 space-y-3">
                      {kpisData.weeklyTrend.map((week) => (
                        <div key={week.semana}>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{week.semana}</span>
                            <span>{formatPct(week.cumplimientoPct)} · {formatSaldoJornada(week.balanceMs)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, week.cumplimientoPct)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {kpisLoading && <p className="text-sm text-muted-foreground">Calculando indicadores…</p>}
        </section>
      )}

      <Dialog
        open={manualFichajeEmp !== null}
        onClose={() => { if (!manualFichajeSaving) { setManualFichajeEmp(null); setManualFichajeRows([]); } }}
        title={`Agregar fichajes — ${manualFichajeEmp ? `${manualFichajeEmp.firstName} ${manualFichajeEmp.lastName}` : ''}`}
        description={`${formatDayHeading(manualFichajeDate || diaFecha)} · hora Argentina (−03:00)`}
        panelClassName="sm:max-w-lg"
      >
        <div className="space-y-2">
          {manualFichajeRows.map((row) => (
            <div key={row.id} className="flex items-center gap-2 flex-wrap">
              <select
                value={String(row.estado)}
                onChange={(e) => updateManualRow(row.id, { estado: Number(e.target.value) as 0 | 1 })}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="0">Entrada</option>
                <option value="1">Salida</option>
              </select>
              <input
                type="date"
                value={row.fecha}
                onChange={(e) => updateManualRow(row.id, { fecha: e.target.value })}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                type="time"
                step={1}
                value={row.hora}
                onChange={(e) => updateManualRow(row.id, { hora: e.target.value })}
                className="rounded border border-border bg-background px-2 py-1 text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={() => removeManualRow(row.id)}
                disabled={manualFichajeRows.length === 1}
                title="Quitar fila"
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addManualRow}
            className="mt-1 text-xs border border-dashed border-border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            + Agregar otro fichaje
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setManualFichajeEmp(null); setManualFichajeRows([]); }}
            disabled={manualFichajeSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void saveManualFichajes()}
            disabled={manualFichajeSaving || manualFichajeRows.length === 0}
          >
            {manualFichajeSaving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </Dialog>

      {activeView === 'reportes' && (
      <>
      <Dialog
        open={reportFixOpen}
        onClose={() => setReportFixOpen(false)}
        title="Corregir fichajes del reporte"
        description={`${reportFixTitle} · ${reportData ? `${reportData.empleado.firstName} ${reportData.empleado.lastName}` : ''}`}
        panelClassName="sm:max-w-3xl"
      >
        <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1">
          {Object.values(editDrafts).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sin fichajes para editar en este día</p>
          )}
          {Object.values(editDrafts)
            .filter((draft) => !draft.forOrphanId)
            .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
            .map((draft) => (
              <div key={draft.fichajeId} className="rounded-lg border border-border bg-muted/20 p-2">
                {renderEditRow(draft, draft.estado === 0 ? 'Entrada' : 'Salida', { showSave: false })}
                {Object.values(editDrafts)
                  .filter((d) => d.forOrphanId === draft.fichajeId)
                  .map((d) => renderEditRow(d, d.estado === 0 ? 'Entrada nueva' : 'Salida nueva', { showSave: false }))}
                {!Object.values(editDrafts).some((d) => d.forOrphanId === draft.fichajeId) && (
                  <button
                    type="button"
                    onClick={() => addReportComplementRow({ id: draft.fichajeId, tiempo: arFechaYHoraToIso(draft.fecha, draft.hora), estado: draft.estado })}
                    className="mt-2 text-xs border border-dashed border-border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  >
                    + Agregar {draft.estado === 0 ? 'salida' : 'entrada'} complementaria
                  </button>
                )}
              </div>
            ))}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={() => setReportFixOpen(false)} disabled={reportFixSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void saveReportFixDrafts()} disabled={reportFixSaving}>
            {reportFixSaving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dayExceptionOpen}
        onClose={() => setDayExceptionOpen(false)}
        title="Editar excepción del día"
        description={`${dayExceptionForm.fecha ? formatDayHeading(dayExceptionForm.fecha) : ''} · ${reportData ? `${reportData.empleado.firstName} ${reportData.empleado.lastName}` : ''}`}
        panelClassName="sm:max-w-lg"
      >
        <div className="space-y-4">
          {dayExceptionLoading ? (
            <p className="text-sm text-muted-foreground">Cargando excepción…</p>
          ) : (
            <>
              <p className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-900 dark:text-blue-100">
                Dejá las horas vacías para justificar el día completo. Si cargás horas, se descuentan de las horas debidas del día sin contarlas como trabajadas.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo</span>
                  <select
                    value={dayExceptionForm.tipo}
                    onChange={(e) => setDayExceptionForm((prev) => ({ ...prev, tipo: e.target.value as TipoAusencia }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {TIPO_AUSENCIA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Horas justificadas</span>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    value={dayExceptionForm.horasJustificadas}
                    onChange={(e) => setDayExceptionForm((prev) => ({ ...prev, horasJustificadas: e.target.value }))}
                    placeholder="Día completo"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="space-y-1 text-sm block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo</span>
                <textarea
                  value={dayExceptionForm.motivo}
                  onChange={(e) => setDayExceptionForm((prev) => ({ ...prev, motivo: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Ej: se retiró por enfermedad"
                />
              </label>
            </>
          )}
        </div>
        <div className="mt-4 flex justify-between gap-2 border-t border-border pt-3">
          <div>
            {dayExceptionExistingId && (
              <Button type="button" variant="outline" onClick={() => void deleteDayException()} disabled={dayExceptionSaving}>
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setDayExceptionOpen(false)} disabled={dayExceptionSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void saveDayException()} disabled={dayExceptionSaving || dayExceptionLoading}>
              {dayExceptionSaving ? 'Guardando…' : 'Guardar excepción'}
            </Button>
          </div>
        </div>
      </Dialog>
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Reporte por empleado</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(220px,1fr)_repeat(3,auto)_auto_auto] gap-3 items-end">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Planta
              </span>
              <PlantaToggle value={selectedPlanta} onChange={setSelectedPlanta} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Empleado
              </span>
              <select
                value={reportEmpleadoId}
                onChange={(e) => {
                  setReportEmpleadoId(e.target.value);
                  setReportHsTouched(false);
                  setReportData(null);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccionar empleado</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Desde
              </span>
              <input
                type="date"
                value={reportDesde}
                onChange={(e) => {
                  setReportDesde(e.target.value);
                  setReportData(null);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Hasta
              </span>
              <input
                type="date"
                value={reportHasta}
                max={hoyYmd}
                onChange={(e) => {
                  setReportHasta(e.target.value);
                  setReportData(null);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Hs/día
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={reportHorasEsperadas}
                onChange={(e) => {
                  setReportHorasEsperadas(e.target.value);
                  setReportHsTouched(true);
                  setReportData(null);
                }}
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <Button
              type="button"
              onClick={() => void loadEmployeeReport()}
              disabled={reportLoading}
            >
              {reportLoading ? 'Generando…' : 'Generar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={exportEmployeeReportExcel}
              disabled={!hasReport}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Días hábiles
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {reportData ? reportData.resumen.diasHabiles : '—'}
              </p>
              {reportData && ((reportData.resumen.diasFeriado ?? 0) + (reportData.resumen.diasAusencia ?? 0)) > 0 && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {reportData.resumen.diasFeriado ? `${reportData.resumen.diasFeriado} feriado(s)` : ''}
                  {reportData.resumen.diasFeriado && reportData.resumen.diasAusencia ? ' · ' : ''}
                  {reportData.resumen.diasAusencia ? `${reportData.resumen.diasAusencia} ausencia(s)` : ''}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Debió trabajar
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {reportData ? formatDuracion(reportData.resumen.esperadoMs) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Trabajó
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {reportData ? formatDuracion(reportData.resumen.trabajadoMs) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Justificadas
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-blue-800 dark:text-blue-200">
                {reportData ? formatDuracion(reportData.resumen.justificadoMs ?? 0) : '—'}
              </p>
            </div>
            <div className={`rounded-lg p-3 ${saldoJornadaClass(reportData?.resumen.saldoMs ?? 0, hasReport)}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                Saldo
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {reportData ? formatSaldoJornada(reportData.resumen.saldoMs) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Horas extra
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-violet-800 dark:text-violet-200">
                {reportData ? formatDuracion(reportData.resumen.horasExtraMs ?? 0) : '—'}
              </p>
            </div>
          </div>

          {hasReport && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-[13rem]">
                      Día
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-[8rem]">
                      Debidas
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-[8rem]">
                      Trabajadas
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-[8rem]">
                      Saldo
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Detalle
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.dias.map((day) => {
                    const observaciones = [
                      ...day.entradasSinSalida.map((f) => unmatchedFichajeText(f, reportData.empleado.planta)),
                      ...day.salidasSinEntrada.map((f) => unmatchedFichajeText(f, reportData.empleado.planta)),
                    ];
                    const noLaborableLabel = day.esAusencia
                      ? `🩺 ${day.tipoAusencia ?? 'Ausencia'}${day.justificadoMs > 0 ? ` · ${formatDuracion(day.justificadoMs)} justificadas` : ''}${day.motivoNoLaborable ? ` — ${day.motivoNoLaborable}` : ''}`
                      : day.esFeriado
                        ? `📅 ${day.motivoNoLaborable ?? 'Feriado'}`
                        : null;
                    const rowClass = day.isHoraExtra
                      ? 'border-b border-border/80 last:border-0 align-top bg-violet-50/60 dark:bg-violet-950/30'
                      : 'border-b border-border/80 last:border-0 align-top';
                    return (
                      <tr key={day.fecha} className={rowClass}>
                        <td className="px-3 py-3">
                          <p className="font-medium capitalize text-foreground">{formatDayHeading(day.fecha)}</p>
                          {noLaborableLabel && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{noLaborableLabel}</p>
                          )}
                          {!noLaborableLabel && !day.diaHabil && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">No hábil</p>
                          )}
                          {day.isHoraExtra && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                              ★ Horas extra
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums">
                          {formatDuracion(day.esperadoMs)}
                          {day.justificadoMs > 0 && (
                            <p className="mt-0.5 text-[11px] font-sans text-blue-700 dark:text-blue-300">
                              - {formatDuracion(day.justificadoMs)} justificadas
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums">
                          {day.tramos.length > 0 ? formatDuracion(day.trabajadoMs) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          {day.isHoraExtra ? (
                            <span className="inline-flex rounded-md px-2 py-1 text-xs font-semibold tabular-nums bg-violet-200 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100">
                              + {formatDuracion(day.trabajadoMs)} (extra)
                            </span>
                          ) : (
                            <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${saldoJornadaClass(day.saldoMs, day.diaHabil || day.tramos.length > 0)}`}>
                              {day.diaHabil || day.tramos.length > 0 ? formatSaldoJornada(day.saldoMs) : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="mb-2 flex flex-wrap gap-2">
                            {day.fichajes.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => openReportFixModal(day)}
                                className="inline-flex rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                              >
                                Corregir fichajes
                              </button>
                            ) : (
                              reportData && (
                                <button
                                  type="button"
                                  onClick={() => openManualFichajeModal(reportData.empleado, day.fecha)}
                                  className="inline-flex rounded-md border border-dashed border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 hover:bg-amber-500/15 dark:text-amber-200"
                                >
                                  + Agregar fichaje
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              onClick={() => void openDayExceptionModal(day)}
                              className="inline-flex rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs text-blue-800 hover:bg-blue-500/15 dark:text-blue-200"
                            >
                              Excepción
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {day.tramos.map((p) => (
                              <div
                                key={`${p.entrada.id}-${p.salida.id}`}
                                className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs mr-1"
                              >
                                <span className="font-mono">{formatSoloHora(p.entrada.tiempo)}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-mono">{formatSoloHora(p.salida.tiempo)}</span>
                                <span className="font-medium">{formatDuracion(p.ms)}</span>
                              </div>
                            ))}
                            {observaciones.map((obs) => (
                              <p key={obs} className="text-xs text-amber-700 dark:text-amber-200">
                                {obs}
                              </p>
                            ))}
                            {day.fichajes.length === 0 && (
                              <span className="text-xs text-muted-foreground">Sin fichajes</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      </>
      )}

      {activeView === 'general' && (
        <>
      <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-[17rem]">
                  Empleado
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-[30rem]">
                  Tramos en planta
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-[9rem]">
                  Planta
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-[10.5rem]">
                  Total del día
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-[10rem]">
                  Saldo jornada
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-[8rem]">
                  Detalle
                </th>
              </tr>
            </thead>
            {aggregates.map((agg) => {
              const tieneValidos = aggHasValidPairs(agg);
              const jornadaHs = jornadaHsForAgg(agg);
              const msJornada = jornadaHs * 3600000;
              const saldoMs = agg.totalMs - msJornada;
              const expanded = expandedKeys.has(agg.key);

              return (
                <tbody key={agg.key} className="border-b border-border last:border-0">
                  <tr className="hover:bg-muted/20 align-top">
                    <td className="px-5 py-5">
                      <p className="font-medium text-foreground leading-snug">{employeeDisplayLabel(agg)}</p>
                    </td>
                    <td className="px-5 py-5">
                      <div className="space-y-2.5">
                        {agg.pairs.map((p) => (
                          <div
                            key={`${p.entrada.id}-${p.salida.id}`}
                            className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs whitespace-nowrap"
                          >
                            <span className="font-mono tabular-nums" title={formatFichajeHora(p.entrada.tiempo)}>
                              {formatSoloHora(p.entrada.tiempo)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono tabular-nums" title={formatFichajeHora(p.salida.tiempo)}>
                              {formatSoloHora(p.salida.tiempo)}
                            </span>
                            <span className="ml-auto pl-4 font-medium tabular-nums text-foreground">
                              {formatDuracion(p.ms)}
                            </span>
                          </div>
                        ))}
                        {agg.pairsEntradaDiaAnterior.map((p) => (
                          <div
                            key={`${p.entrada.id}-${p.salida.id}`}
                            className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100 whitespace-nowrap"
                            title={`Entrada el día anterior · ${formatFichajeHora(p.entrada.tiempo)}. El total se computa en este día.`}
                          >
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-mono tabular-nums">{formatSoloHora(p.entrada.tiempo)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono tabular-nums">{formatSoloHora(p.salida.tiempo)}</span>
                            <span className="ml-auto pl-3 font-medium tabular-nums">{formatDuracion(p.ms)}</span>
                            <span className="text-[11px] opacity-80">entrada día ant.</span>
                          </div>
                        ))}
                        {agg.pairsSalidaDiaSiguiente.map((p) => (
                          <div
                            key={`${p.entrada.id}-${p.salida.id}`}
                            className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100 whitespace-nowrap"
                            title={`Salida el día siguiente · ${formatFichajeHora(p.salida.tiempo)}. El total se computa en ese día.`}
                          >
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-mono tabular-nums">{formatSoloHora(p.entrada.tiempo)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono tabular-nums">{formatSoloHora(p.salida.tiempo)}</span>
                            <span className="ml-auto pl-3 text-[11px] opacity-80">salida día sig.</span>
                          </div>
                        ))}
                        {agg.orphanEntradas.map((f) => (
                          <div
                            key={f.id}
                            className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 whitespace-nowrap overflow-hidden text-ellipsis"
                          >
                            {f.planta === 'villa_nueva' ? 'Fichaje sin emparejar' : 'Entrada sin salida'} ·{' '}
                            <span className="font-mono">{formatSoloHora(f.tiempo)}</span>
                          </div>
                        ))}
                        {agg.orphanSalidas.map((f) => (
                          <div
                            key={f.id}
                            className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 whitespace-nowrap overflow-hidden text-ellipsis"
                          >
                            {f.planta === 'villa_nueva' ? 'Fichaje sin emparejar' : 'Salida sin entrada emparejada'} ·{' '}
                            <span className="font-mono">{formatSoloHora(f.tiempo)}</span>
                          </div>
                        ))}
                        {agg.pairs.length === 0 &&
                          agg.pairsEntradaDiaAnterior.length === 0 &&
                          agg.pairsSalidaDiaSiguiente.length === 0 &&
                          agg.orphanEntradas.length === 0 &&
                          agg.orphanSalidas.length === 0 && (
                          <span className="text-muted-foreground text-xs">Sin movimientos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5 text-xs text-muted-foreground align-middle capitalize whitespace-nowrap">
                      {plantasLabel(agg)}
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <div
                        className={`inline-flex w-full flex-col rounded-lg px-3 py-3 text-center ${duracionTotalClass(agg.totalMs, tieneValidos, msJornada)}`}
                        title={
                          tieneValidos
                            ? `${(agg.totalMs / 3600000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} h totales`
                            : 'Suma solo tramos entrada→salida válidos'
                        }
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                          En planta
                        </span>
                        <span className="text-lg tabular-nums leading-tight mt-0.5">
                          {tieneValidos ? formatDuracion(agg.totalMs) : '—'}
                        </span>
                        {tieneValidos && (
                          <span className="text-[10px] opacity-70 mt-1">
                            {agg.totalMs >= msJornada ? `≥ ${jornadaHs} h` : `< ${jornadaHs} h`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <div
                        className={`inline-flex w-full flex-col rounded-lg px-3 py-3 text-center font-semibold ${saldoJornadaClass(saldoMs, tieneValidos)}`}
                        title={
                          tieneValidos
                            ? `Diferencia contra ${jornadaHs} h: ${formatSaldoJornada(saldoMs)}`
                            : 'Requiere al menos un tramo entrada→salida válido'
                        }
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                          Diferencia
                        </span>
                        <span className="text-base tabular-nums leading-tight mt-0.5">
                          {tieneValidos ? formatSaldoJornada(saldoMs) : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-5 text-right align-middle">
                      <button
                        type="button"
                        onClick={() => toggleExpand(agg.key)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs whitespace-nowrap hover:bg-accent"
                      >
                        Fichajes
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/15">
                      <td colSpan={6} className="px-4 py-3 border-t border-border/60">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {agg.fichajes.map((f) => {
                            const d = draftFor(f);
                            return (
                              <div
                                key={f.id}
                                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2"
                              >
                                <span className="font-mono text-xs tabular-nums shrink-0">
                                  {formatSoloHora(f.tiempo)}
                                </span>
                                <select
                                  value={d.estado}
                                  onChange={(e) =>
                                    updateDraft(f.id, { estado: e.target.value as EstadoOption })
                                  }
                                  className="rounded-md border border-border bg-background px-2 py-1 text-xs flex-1 min-w-[5rem]"
                                >
                                  <option value="0">Entrada</option>
                                  <option value="1">Salida</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => void saveRow(f)}
                                  disabled={savingId === f.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
                                >
                                  <Save className="h-3 w-3" />
                                  Guardar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
            {absentEmpleados.map((emp) => (
              <tbody key={`absent-${emp.id}`} className="border-b border-border last:border-0">
                <tr className="bg-red-500/8 hover:bg-red-500/12 align-top">
                  <td className="px-5 py-5">
                    <p className="font-medium text-red-700 dark:text-red-300 leading-snug">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-red-500/70 mt-0.5">Sin fichajes</p>
                  </td>
                  <td className="px-5 py-5">
                    <span className="text-xs text-red-600/60 dark:text-red-400/60 italic">— Sin movimientos</span>
                  </td>
                  <td className="px-5 py-5 text-xs text-muted-foreground align-middle capitalize whitespace-nowrap">
                    {plantaDisplayName(emp.planta)}
                  </td>
                  <td className="px-5 py-5 align-middle">
                    <div className="inline-flex w-full flex-col rounded-lg bg-red-500/15 px-3 py-3 text-center text-red-700 dark:text-red-300">
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">En planta</span>
                      <span className="text-lg tabular-nums leading-tight mt-0.5">—</span>
                    </div>
                  </td>
                  <td className="px-5 py-5 align-middle">
                    <div className="inline-flex w-full flex-col rounded-lg bg-red-500/15 px-3 py-3 text-center text-red-700 dark:text-red-300">
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">Diferencia</span>
                      <span className="text-base tabular-nums leading-tight mt-0.5">—</span>
                    </div>
                  </td>
                  <td className="px-5 py-5 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => openManualFichajeModal(emp)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-red-400/50 bg-red-500/8 px-3 py-1.5 text-xs text-red-700 dark:text-red-300 hover:bg-red-500/15 hover:border-red-400 transition-colors"
                    >
                      + Agregar fichaje
                    </button>
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
        {!loading && itemsMismoDiaAr.length === 0 && absentEmpleados.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay fichajes en este día con esos filtros.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm flex-wrap gap-3 pt-2">
        <p className="text-muted-foreground capitalize">{formatDayHeading(diaFecha)}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDiaFecha((d) => addDaysYmdAr(d, -1))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
            Día anterior
          </button>
          <button
            type="button"
            onClick={() => setDiaFecha((d) => addDaysYmdAr(d, 1))}
            disabled={!puedeDiaSiguiente}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40"
          >
            Día siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
        </>
      )}

      {activeView === 'empleados' && (
        <>
          <Dialog
            open={nuevoEmpOpen}
            onClose={() => !savingNuevo && setNuevoEmpOpen(false)}
            title="Nuevo empleado"
            panelClassName="max-w-md"
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre *</span>
                  <input
                    type="text"
                    value={nuevoEmpForm.firstName}
                    onChange={(e) => setNuevoEmpForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="Nombre"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Apellido *</span>
                  <input
                    type="text"
                    value={nuevoEmpForm.lastName}
                    onChange={(e) => setNuevoEmpForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Apellido"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIN *</span>
                  <input
                    type="text"
                    value={nuevoEmpForm.pin}
                    onChange={(e) => setNuevoEmpForm((f) => ({ ...f, pin: e.target.value }))}
                    placeholder="PIN del reloj"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Planta *</span>
                  <select
                    value={nuevoEmpForm.planta}
                    onChange={(e) => setNuevoEmpForm((f) => ({ ...f, planta: e.target.value as Planta }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {PLANTAS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">DNI (opcional)</span>
                  <input
                    type="text"
                    value={nuevoEmpForm.dni}
                    onChange={(e) => setNuevoEmpForm((f) => ({ ...f, dni: e.target.value }))}
                    placeholder="DNI"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Hs/día (override)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={nuevoEmpForm.horasEsperadasDia}
                    onChange={(e) => setNuevoEmpForm((f) => ({ ...f, horasEsperadasDia: e.target.value }))}
                    placeholder={`Default ${DEFAULT_HORAS_POR_PLANTA[nuevoEmpForm.planta]} hs`}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setNuevoEmpOpen(false)} disabled={savingNuevo}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void crearNuevoEmpleado()} disabled={savingNuevo}>
                {savingNuevo ? 'Creando…' : 'Crear empleado'}
              </Button>
            </div>
          </Dialog>

          <div className="flex items-center gap-3 flex-wrap">
            <PlantaToggle value={selectedPlanta} onChange={setSelectedPlanta} />
            <button
              type="button"
              onClick={() => void loadTodosEmpleados()}
              disabled={empLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${empLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => {
                setNuevoEmpForm({ firstName: '', lastName: '', pin: '', planta: selectedPlanta, dni: '', horasEsperadasDia: '' });
                setNuevoEmpOpen(true);
              }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + Nuevo empleado
            </button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Apellido</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">PIN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Planta</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">DNI</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">Hs/día</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">Activo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</td>
                    </tr>
                  ) : todosEmpleados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin empleados</td>
                    </tr>
                  ) : (
                    todosEmpleados.map((emp) => {
                        const isEditing = editingEmpId === emp.id;
                        const isSaving = savingEmpId === emp.id;
                        return (
                          <tr key={emp.id} className={`border-b border-border/60 last:border-0 hover:bg-muted/20 ${!emp.activo ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editEmpDraft.firstName}
                                  onChange={(e) => setEditEmpDraft((d) => ({ ...d, firstName: e.target.value }))}
                                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                                />
                              ) : (
                                <span className="font-medium text-foreground">{emp.firstName}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editEmpDraft.lastName}
                                  onChange={(e) => setEditEmpDraft((d) => ({ ...d, lastName: e.target.value }))}
                                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                                />
                              ) : (
                                <span>{emp.lastName}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editEmpDraft.pin}
                                  onChange={(e) => setEditEmpDraft((d) => ({ ...d, pin: e.target.value }))}
                                  className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm font-mono"
                                />
                              ) : (
                                <span className="font-mono text-muted-foreground">{emp.pin}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <select
                                  value={editEmpDraft.planta}
                                  onChange={(e) => setEditEmpDraft((d) => ({ ...d, planta: e.target.value as Planta }))}
                                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                                >
                                  {PLANTAS.map(({ value, label }) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                                  {plantaDisplayName(emp.planta)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editEmpDraft.dni ?? ''}
                                  onChange={(e) => setEditEmpDraft((d) => ({ ...d, dni: e.target.value }))}
                                  placeholder="—"
                                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                                />
                              ) : (
                                <span className="text-muted-foreground">{emp.dni ?? '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={24}
                                  step={0.5}
                                  value={editEmpDraft.horasEsperadasDia ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditEmpDraft((d) => ({
                                      ...d,
                                      horasEsperadasDia: v === '' ? null : Number(v),
                                    }));
                                  }}
                                  placeholder={`${DEFAULT_HORAS_POR_PLANTA[editEmpDraft.planta]}`}
                                  className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
                                />
                              ) : emp.horasEsperadasDia != null ? (
                                <span
                                  className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  title="Override individual"
                                >
                                  {emp.horasEsperadasDia} h
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs" title="Usa el default de la planta">
                                  {DEFAULT_HORAS_POR_PLANTA[emp.planta]} h (default)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <input
                                  type="checkbox"
                                  checked={editEmpDraft.activo ?? true}
                                  onChange={(e) => setEditEmpDraft((d) => ({ ...d, activo: e.target.checked }))}
                                  className="accent-primary h-4 w-4"
                                />
                              ) : (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${emp.activo ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                                  {emp.activo ? 'Sí' : 'No'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isEditing ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setEditingEmpId(null)}
                                      disabled={isSaving}
                                      className="h-7 px-2 text-xs"
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => void saveEditEmp(emp.id)}
                                      disabled={isSaving}
                                      className="h-7 px-2 text-xs"
                                    >
                                      {isSaving ? 'Guardando…' : 'Guardar'}
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditEmp(emp)}
                                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteEmp(emp.id, `${emp.firstName} ${emp.lastName}`)}
                                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                                    >
                                      Eliminar
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeView === 'pines' && (
        <>
          <Dialog
            open={crearEmpleadoPin !== null}
            onClose={() => !savingCrear && setCrearEmpleadoPin(null)}
            title="Crear empleado"
            description={`PIN ${crearEmpleadoPin?.pin ?? ''} · ${crearEmpleadoPin?.planta ? plantaDisplayName(crearEmpleadoPin.planta) : ''}`}
            panelClassName="max-w-md"
          >
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre *</span>
                <input
                  type="text"
                  value={crearForm.firstName}
                  onChange={(e) => setCrearForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Nombre"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Apellido *</span>
                <input
                  type="text"
                  value={crearForm.lastName}
                  onChange={(e) => setCrearForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Apellido"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">DNI (opcional)</span>
                <input
                  type="text"
                  value={crearForm.dni}
                  onChange={(e) => setCrearForm((f) => ({ ...f, dni: e.target.value }))}
                  placeholder="DNI"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCrearEmpleadoPin(null)}
                disabled={savingCrear}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void crearEmpleadoDesdePin()}
                disabled={savingCrear}
              >
                {savingCrear ? 'Creando…' : 'Crear empleado'}
              </Button>
            </div>
          </Dialog>

          <div className="flex items-center gap-3 flex-wrap">
            <PlantaToggle value={selectedPlanta} onChange={setSelectedPlanta} />
            <button
              type="button"
              onClick={() => void loadPines()}
              disabled={pinesLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pinesLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">PIN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Planta device</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Planta empleado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">Fichajes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Último fichaje</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-72">Asignar empleado</th>
                  </tr>
                </thead>
                <tbody>
                  {pinesLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Cargando…
                      </td>
                    </tr>
                  ) : pines.filter((r) => r.planta === selectedPlanta).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Sin datos
                      </td>
                    </tr>
                  ) : (
                    pines
                      .filter((r) => r.planta === selectedPlanta)
                      .map((row) => {
                        const key = `${row.pin}:${row.planta}`;
                        const isAssigning = asignandoKey === key;
                        const plantaMismatch =
                          row.empleadoPlanta !== null && row.empleadoPlanta !== row.planta;
                        const opcionesEmpleados = empleadosByPlanta.get(row.planta) ?? [];
                        return (
                          <tr
                            key={key}
                            className={`border-b border-border/60 last:border-0 hover:bg-muted/20 ${plantaMismatch ? 'bg-red-500/5' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono font-semibold text-foreground">{row.pin}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground capitalize">
                                {plantaDisplayName(row.planta)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {row.empleadoNombre ? (
                                <span className="font-medium text-foreground">{row.empleadoNombre}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60 italic">Sin empleado</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.empleadoPlanta ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${plantaMismatch ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}>
                                  {plantaMismatch && <span title="La planta del empleado no coincide con la del device">⚠</span>}
                                  {plantaDisplayName(row.empleadoPlanta)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {row.totalFichajes}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {row.ultimoFichaje ? formatFichajeHora(row.ultimoFichaje) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <select
                                  value={row.empleadoId ?? ''}
                                  disabled={isAssigning}
                                  onChange={(e) => {
                                    const next = e.target.value || null;
                                    if (next === (row.empleadoId ?? null)) return;
                                    if (
                                      next === null &&
                                      !window.confirm(
                                        `¿Quitar el empleado de TODOS los fichajes del PIN ${row.pin} (${plantaDisplayName(row.planta)})?`,
                                      )
                                    ) {
                                      return;
                                    }
                                    void asignarEmpleadoAPin(row, next);
                                  }}
                                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
                                >
                                  <option value="">Sin asignar</option>
                                  {opcionesEmpleados.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.firstName} {emp.lastName}
                                    </option>
                                  ))}
                                </select>
                                {!row.empleadoId && (
                                  <button
                                    type="button"
                                    disabled={isAssigning}
                                    onClick={() => {
                                      setCrearForm({ firstName: '', lastName: '', dni: '' });
                                      setCrearEmpleadoPin(row);
                                    }}
                                    className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50 whitespace-nowrap"
                                  >
                                    + Crear
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <CalendarioLaboralModal
        open={calendarioOpen}
        onClose={() => setCalendarioOpen(false)}
      />
    </div>
  );
}
