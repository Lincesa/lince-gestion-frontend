import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, Info, Mail, RefreshCw, Save, Trash2 } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { asistenciaApi, type UpdateEmpleadoPayload } from '@/api/asistencia';
import type { EmpleadoAsistencia, FichajeAsistencia, Planta, PinSummaryRow, ReporteEmpleadoRango } from '@/types';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

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
}

const AR_TZ = 'America/Argentina/Buenos_Aires';
const HORAS_JORNADA = 9;
const MS_JORNADA = HORAS_JORNADA * 60 * 60 * 1000;
const DEFAULT_PLANTA: Planta = 'villa_nueva';
const PLANTAS: { value: Planta; label: string }[] = [
  { value: 'villa_nueva', label: 'Villa María' },
  { value: 'tucuman', label: 'Tucumán' },
];

function plantaDisplayName(planta: Planta | string): string {
  if (planta === 'villa_nueva') return 'Villa María';
  if (planta === 'tucuman') return 'Tucumán';
  return planta.replace(/_/g, ' ');
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

function duracionTotalClass(totalMs: number, tieneIntervalosValidos: boolean): string {
  if (!tieneIntervalosValidos) {
    return 'bg-muted/40 text-muted-foreground';
  }
  if (totalMs >= MS_JORNADA) {
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

function esEntradaNocturna(iso: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ, hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .find((p) => p.type === 'hour')?.value ?? '0',
  );
  return hour >= 18;
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
  return f.empleadoId ? `id:${f.empleadoId}` : `pin:${f.pin}`;
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
  pairsSalidaDiaSiguiente: FichajePair[];
  orphanEntradas: FichajeAsistencia[];
  orphanSalidas: FichajeAsistencia[];
  totalMs: number;
}

function buildEmployeeDayAggregates(items: FichajeAsistencia[], requestedDay: string): EmployeeDayAgg[] {
  const byEmp = new Map<string, FichajeAsistencia[]>();
  for (const r of items) {
    const k = employeeKey(r);
    const arr = byEmp.get(k) ?? [];
    arr.push(r);
    byEmp.set(k, arr);
  }

  const aggs: EmployeeDayAgg[] = [];

  for (const [key, evs] of byEmp) {
    const sorted = [...evs].sort(
      (a, b) => new Date(a.tiempo).getTime() - new Date(b.tiempo).getTime(),
    );
    const allPairs: FichajePair[] = [];
    const allOrphanEntradas: FichajeAsistencia[] = [];
    const allOrphanSalidas: FichajeAsistencia[] = [];
    const openEntradas: FichajeAsistencia[] = [];

    for (const ev of sorted) {
      if (ev.estado === 0) {
        openEntradas.push(ev);
      } else {
        const salidaMs = new Date(ev.tiempo).getTime();
        while (
          openEntradas.length > 0 &&
          new Date(openEntradas[0].tiempo).getTime() >= salidaMs
        ) {
          allOrphanEntradas.push(openEntradas.shift()!);
        }
        const entrada = openEntradas.shift();
        if (entrada) {
          const ms = salidaMs - new Date(entrada.tiempo).getTime();
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

    // Turnos nocturnos: el backend devuelve desde las 18:00 del día anterior
    // y hasta las 14:00 del día siguiente. El total se imputa al día de salida.
    // - pairs: tramos cuya salida cae en el día consultado (suman al total).
    // - pairsSalidaDiaSiguiente: tramos que empiezan en el día consultado pero
    //   cierran al día siguiente; se muestran como informativos y NO suman.
    const pairs = allPairs.filter((p) => tiempoYmdEnAr(p.salida.tiempo) === requestedDay);
    const pairsSalidaDiaSiguiente = allPairs.filter(
      (p) =>
        tiempoYmdEnAr(p.entrada.tiempo) === requestedDay &&
        tiempoYmdEnAr(p.salida.tiempo) !== requestedDay,
    );
    const orphanEntradas = allOrphanEntradas.filter((f) => tiempoYmdEnAr(f.tiempo) === requestedDay);
    const orphanSalidas = allOrphanSalidas.filter((f) => tiempoYmdEnAr(f.tiempo) === requestedDay);

    if (
      pairs.length === 0 &&
      pairsSalidaDiaSiguiente.length === 0 &&
      orphanEntradas.length === 0 &&
      orphanSalidas.length === 0
    ) {
      continue;
    }

    let totalMs = 0;
    for (const p of pairs) {
      totalMs += p.ms;
    }

    const fichajesMap = new Map<string, FichajeAsistencia>();
    for (const p of pairs) {
      fichajesMap.set(p.entrada.id, p.entrada);
      fichajesMap.set(p.salida.id, p.salida);
    }
    for (const p of pairsSalidaDiaSiguiente) {
      fichajesMap.set(p.entrada.id, p.entrada);
      fichajesMap.set(p.salida.id, p.salida);
    }
    for (const f of orphanEntradas) fichajesMap.set(f.id, f);
    for (const f of orphanSalidas) fichajesMap.set(f.id, f);
    const fichajes = [...fichajesMap.values()].sort(
      (a, b) => new Date(a.tiempo).getTime() - new Date(b.tiempo).getTime(),
    );

    aggs.push({
      key,
      fichajes,
      pairs,
      pairsSalidaDiaSiguiente,
      orphanEntradas,
      orphanSalidas,
      totalMs,
    });
  }

  aggs.sort((a, b) => {
    const t = (x: EmployeeDayAgg) =>
      Math.max(...x.fichajes.map((f) => new Date(f.tiempo).getTime()), 0);
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


export function RrhhPage() {
  const location = useLocation();
  const activeView = location.pathname.endsWith('/reportes')
    ? 'reportes'
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
  const [reportHorasEsperadas, setReportHorasEsperadas] = useState(String(HORAS_JORNADA));
  const [reportData, setReportData] = useState<ReporteEmpleadoRango | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'today' | 'other' | 'range'>('today');
  const [exportOtherDate, setExportOtherDate] = useState(todayYmdAr);
  const [exportDesde, setExportDesde] = useState(todayYmdAr);
  const [exportHasta, setExportHasta] = useState(todayYmdAr);
  const [exportLoading, setExportLoading] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
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
  const [nuevoEmpForm, setNuevoEmpForm] = useState<{ firstName: string; lastName: string; pin: string; planta: Planta; dni: string }>({ firstName: '', lastName: '', pin: '', planta: DEFAULT_PLANTA, dni: '' });
  const [savingNuevo, setSavingNuevo] = useState(false);

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
        asistenciaApi.getEmpleados(selectedPlanta),
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
      setEmpleados(await asistenciaApi.getEmpleados(selectedPlanta));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  useEffect(() => {
    if (activeView === 'general') {
      void loadData();
    } else if (activeView === 'pines') {
      void loadPines();
    } else if (activeView === 'empleados') {
      void loadTodosEmpleados();
    } else {
      void loadReportEmployees();
    }
  }, [activeView, diaFecha, estado, selectedPlanta]);

  useEffect(() => {
    if (!reportEmpleadoId) return;
    const emp = empleados.find((e) => e.id === reportEmpleadoId);
    if (emp && emp.planta !== selectedPlanta) {
      setReportEmpleadoId('');
      setReportData(null);
    }
  }, [selectedPlanta, empleados, reportEmpleadoId]);

  const onRefresh = async () => {
    await loadData();
  };

  const loadPines = async () => {
    setPinesLoading(true);
    try {
      const [data, emps] = await Promise.all([
        asistenciaApi.getPinesSummary(),
        asistenciaApi.getEmpleados(selectedPlanta),
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
    setEditEmpDraft({ firstName: emp.firstName, lastName: emp.lastName, pin: emp.pin, planta: emp.planta, dni: emp.dni ?? '', activo: emp.activo });
  };

  const saveEditEmp = async (id: string) => {
    setSavingEmpId(id);
    try {
      const updated = await asistenciaApi.updateEmpleado(id, editEmpDraft);
      setTodosEmpleados((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingEmpId(null);
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
      const created = await asistenciaApi.createEmpleado({
        firstName: nuevoEmpForm.firstName.trim(),
        lastName: nuevoEmpForm.lastName.trim(),
        pin: nuevoEmpForm.pin.trim(),
        planta: nuevoEmpForm.planta,
        dni: nuevoEmpForm.dni.trim() || undefined,
        activo: true,
      });
      setTodosEmpleados((prev) => [...prev, created].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      setNuevoEmpOpen(false);
      setNuevoEmpForm({ firstName: '', lastName: '', pin: '', planta: selectedPlanta, dni: '' });
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

  const loadEmployeeReport = async () => {
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
        horasEsperadasPorDia: reportExpectedHoursNum,
      });
      setReportData(data);
      toast.success(`Reporte generado: ${data.dias.length} día(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReportLoading(false);
    }
  };

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
        ...day.entradasSinSalida.map((f) => `Entrada sin salida ${formatSoloHora(f.tiempo)}`),
        ...day.salidasSinEntrada.map((f) => `Salida sin entrada ${formatSoloHora(f.tiempo)}`),
      ].join(' | ');
      return {
        Fecha: day.fecha,
        Día: formatDayHeading(day.fecha),
        'Día hábil': day.diaHabil ? 'Sí' : 'No',
        'Horas debidas': day.esperadoMs / 3600000,
        'Horas trabajadas': day.trabajadoMs / 3600000,
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
      const dayData = await Promise.all(
        fechas.map(async (fecha) => {
          const page = await asistenciaApi.getFichajes({ fecha, planta: selectedPlanta });
          return { fecha, aggs: buildEmployeeDayAggregates(page.items, fecha) };
        }),
      );

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
          'Empleado', 'Planta', 'Tramos entrada→salida', 'Total del día', `Saldo ${HORAS_JORNADA}h`, 'Observaciones',
        ]);
        headerRow.height = 20;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
          cell.font = { bold: true, color: { argb: COLOR_HEADER_FG }, size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF6C757D' } } };
        });

        for (const agg of aggs) {
          const tieneValidos = agg.pairs.length > 0;
          const saldoMs = agg.totalMs - MS_JORNADA;

          const tramos = agg.pairs
            .map((p) => `${formatSoloHora(p.entrada.tiempo)} → ${formatSoloHora(p.salida.tiempo)} (${formatDuracion(p.ms)})`)
            .join('  |  ');

          const observaciones = [
            ...agg.pairsSalidaDiaSiguiente.map(
              (p) => `↗ Turno cruza al día siguiente: ${formatSoloHora(p.entrada.tiempo)} → ${formatSoloHora(p.salida.tiempo)} (total computado en el día de salida)`,
            ),
            ...agg.orphanEntradas.map((f) => `⚠ Entrada sin salida: ${formatSoloHora(f.tiempo)}`),
            ...agg.orphanSalidas.map((f) => `⚠ Salida sin entrada: ${formatSoloHora(f.tiempo)}`),
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
          } else if (agg.totalMs >= MS_JORNADA) {
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
      next[f.id] = {
        fichajeId: f.id,
        isNew: false,
        pin: f.pin,
        planta: f.planta,
        empleadoId: f.empleadoId ?? null,
        estado: f.estado,
        fecha: tiempoYmdEnAr(f.tiempo),
        hora: tiempoHmsEnAr(f.tiempo),
        saving: false,
      };
    }
    setEditDrafts(next);
    setEditHorariosOpen(true);
  };

  const saveEditRow = async (fichajeId: string) => {
    const draft = editDrafts[fichajeId];
    if (!draft) return;

    setEditDrafts((prev) => ({
      ...prev,
      [fichajeId]: { ...prev[fichajeId], saving: true },
    }));

    try {
      const tiempo = arFechaYHoraToIso(draft.fecha, draft.hora);

      if (draft.isNew) {
        await asistenciaApi.createFichaje({
          pin: draft.pin,
          planta: draft.planta!,
          estado: draft.estado,
          tiempo,
          empleadoId: draft.empleadoId,
        });
      } else {
        const orig = items.find((f) => f.id === fichajeId);
        if (orig) {
          const patch: { tiempo?: string; estado?: 0 | 1 } = {};
          if (new Date(tiempo).getTime() !== new Date(orig.tiempo).getTime()) patch.tiempo = tiempo;
          if (draft.estado !== orig.estado) patch.estado = draft.estado;
          if (Object.keys(patch).length === 0) {
            toast.message('Sin cambios');
            setEditDrafts((prev) => ({ ...prev, [fichajeId]: { ...prev[fichajeId], saving: false } }));
            return;
          }
          await asistenciaApi.updateFichaje(fichajeId, patch);
        }
      }

      toast.success('Guardado');

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
          next[f.id] = {
            fichajeId: f.id,
            isNew: false,
            pin: f.pin,
            planta: f.planta,
            empleadoId: f.empleadoId ?? null,
            estado: f.estado,
            fecha: tiempoYmdEnAr(f.tiempo),
            hora: tiempoHmsEnAr(f.tiempo),
            saving: false,
          };
        }
        for (const [key, d] of Object.entries(prev)) {
          if (d.isNew && key !== fichajeId) next[key] = d;
        }
        return next;
      });
    } catch (err) {
      toast.error((err as Error).message);
      setEditDrafts((prev) => ({
        ...prev,
        [fichajeId]: { ...prev[fichajeId], saving: false },
      }));
    }
  };

  const addComplementRow = (orphan: FichajeAsistencia) => {
    const complementEstado: 0 | 1 = orphan.estado === 0 ? 1 : 0;
    const orphanMs = new Date(orphan.tiempo).getTime();
    const delta = orphan.estado === 0 ? MS_JORNADA : -MS_JORNADA;
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
          next[f.id] = {
            fichajeId: f.id,
            isNew: false,
            pin: f.pin,
            planta: f.planta,
            empleadoId: f.empleadoId ?? null,
            estado: f.estado,
            fecha: tiempoYmdEnAr(f.tiempo),
            hora: tiempoHmsEnAr(f.tiempo),
            saving: false,
          };
        }
        for (const [key, d] of Object.entries(prev)) {
          if (d.isNew) next[key] = d;
        }
        return next;
      });
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
    const orig = items.find((f) => f.id === draft.fichajeId);
    if (!orig) return false;
    return (
      draft.estado !== orig.estado ||
      draft.fecha !== tiempoYmdEnAr(orig.tiempo) ||
      draft.hora !== tiempoHmsEnAr(orig.tiempo)
    );
  };

  const renderEditRow = (draft: EditRowDraft | undefined, label: string) => {
    if (!draft) return null;
    const dirty = isEditRowDirty(draft);
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
            disabled={sendingReport}
            onClick={async () => {
              setSendingReport(true);
              try {
                await asistenciaApi.sendDailyReport(diaFecha);
                toast.success(`Reporte enviado por correo (${diaFecha})`);
              } catch {
                toast.error('Error al enviar el correo — revisá los logs del servidor');
              } finally {
                setSendingReport(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50"
          >
            <Mail className={`h-3.5 w-3.5 ${sendingReport ? 'animate-pulse' : ''}`} />
            {sendingReport ? 'Enviando…' : 'Enviar correo'}
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

                {agg.orphanEntradas.map((f) => {
                  const hasComplement = Object.values(editDrafts).some((d) => d.forOrphanId === f.id);
                  const nocturna = esEntradaNocturna(f.tiempo);
                  return (
                    <div key={f.id} className="pl-3 border-l-2 border-amber-400/60 space-y-0.5">
                      <p className="text-xs text-amber-500 font-medium mb-1">
                        {nocturna ? '🌙 Turno nocturno — salida al día siguiente' : '⚠ Entrada sin emparejar'}
                      </p>
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
                      <p className="text-xs text-amber-500 font-medium mb-1">⚠ Salida sin emparejar</p>
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

      {activeView === 'reportes' && (
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Días hábiles
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {reportData ? reportData.resumen.diasHabiles : '—'}
              </p>
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
            <div className={`rounded-lg p-3 ${saldoJornadaClass(reportData?.resumen.saldoMs ?? 0, hasReport)}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                Saldo
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {reportData ? formatSaldoJornada(reportData.resumen.saldoMs) : '—'}
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
                      ...day.entradasSinSalida.map((f) => `Entrada sin salida ${formatSoloHora(f.tiempo)}`),
                      ...day.salidasSinEntrada.map((f) => `Salida sin entrada ${formatSoloHora(f.tiempo)}`),
                    ];
                    return (
                      <tr key={day.fecha} className="border-b border-border/80 last:border-0 align-top">
                        <td className="px-3 py-3">
                          <p className="font-medium capitalize text-foreground">{formatDayHeading(day.fecha)}</p>
                          {!day.diaHabil && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">No hábil</p>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums">
                          {formatDuracion(day.esperadoMs)}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums">
                          {day.tramos.length > 0 ? formatDuracion(day.trabajadoMs) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${saldoJornadaClass(day.saldoMs, day.diaHabil || day.tramos.length > 0)}`}>
                            {day.diaHabil || day.tramos.length > 0 ? formatSaldoJornada(day.saldoMs) : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
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
                  Saldo {HORAS_JORNADA} h
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-[8rem]">
                  Detalle
                </th>
              </tr>
            </thead>
            {aggregates.map((agg) => {
              const tieneValidos = agg.pairs.length > 0;
              const saldoMs = agg.totalMs - MS_JORNADA;
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
                            {esEntradaNocturna(f.tiempo)
                              ? <>🌙 Turno nocturno · <span className="font-mono">{formatSoloHora(f.tiempo)}</span></>
                              : <>Entrada sin salida · <span className="font-mono">{formatSoloHora(f.tiempo)}</span></>
                            }
                          </div>
                        ))}
                        {agg.orphanSalidas.map((f) => (
                          <div
                            key={f.id}
                            className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 whitespace-nowrap overflow-hidden text-ellipsis"
                          >
                            Salida sin entrada emparejada ·{' '}
                            <span className="font-mono">{formatSoloHora(f.tiempo)}</span>
                          </div>
                        ))}
                        {agg.pairs.length === 0 &&
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
                        className={`inline-flex w-full flex-col rounded-lg px-3 py-3 text-center ${duracionTotalClass(agg.totalMs, tieneValidos)}`}
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
                            {agg.totalMs >= MS_JORNADA ? `≥ ${HORAS_JORNADA} h` : `< ${HORAS_JORNADA} h`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <div
                        className={`inline-flex w-full flex-col rounded-lg px-3 py-3 text-center font-semibold ${saldoJornadaClass(saldoMs, tieneValidos)}`}
                        title={
                          tieneValidos
                            ? `Diferencia contra ${HORAS_JORNADA} h: ${formatSaldoJornada(saldoMs)}`
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
          </table>
        </div>
        {!loading && itemsMismoDiaAr.length === 0 && (
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
                setNuevoEmpForm({ firstName: '', lastName: '', pin: '', planta: selectedPlanta, dni: '' });
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">Activo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</td>
                    </tr>
                  ) : todosEmpleados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin empleados</td>
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
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Cargando…
                      </td>
                    </tr>
                  ) : pines.filter((r) => r.planta === selectedPlanta).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
    </div>
  );
}
