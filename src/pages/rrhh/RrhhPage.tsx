import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, RefreshCw, Save } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { asistenciaApi } from '@/api/asistencia';
import type { EmpleadoAsistencia, FichajeAsistencia, Planta, ReporteEmpleadoRango } from '@/types';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

type EstadoOption = '' | '0' | '1';

interface RowDraft {
  estado: EstadoOption;
  empleadoId: string;
}

interface HorarioEdit {
  fecha: string;
  hora: string;
  estado: 0 | 1;
}

const AR_TZ = 'America/Argentina/Buenos_Aires';
const HORAS_JORNADA = 9;
const MS_JORNADA = HORAS_JORNADA * 60 * 60 * 1000;

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

interface EmployeeDayAgg {
  key: string;
  fichajes: FichajeAsistencia[];
  pairs: { entrada: FichajeAsistencia; salida: FichajeAsistencia; ms: number }[];
  orphanEntradas: FichajeAsistencia[];
  orphanSalidas: FichajeAsistencia[];
  totalMs: number;
}

function buildEmployeeDayAggregates(items: FichajeAsistencia[]): EmployeeDayAgg[] {
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
    const pairs: { entrada: FichajeAsistencia; salida: FichajeAsistencia; ms: number }[] = [];
    const orphanEntradas: FichajeAsistencia[] = [];
    const orphanSalidas: FichajeAsistencia[] = [];
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
          orphanEntradas.push(openEntradas.shift()!);
        }
        const entrada = openEntradas.shift();
        if (entrada) {
          const ms = salidaMs - new Date(entrada.tiempo).getTime();
          if (ms >= 0) {
            pairs.push({ entrada, salida: ev, ms });
          } else {
            orphanSalidas.push(ev);
            openEntradas.unshift(entrada);
          }
        } else {
          orphanSalidas.push(ev);
        }
      }
    }
    orphanEntradas.push(...openEntradas);

    let totalMs = 0;
    for (const p of pairs) {
      totalMs += p.ms;
    }

    const fichajesMap = new Map<string, FichajeAsistencia>();
    for (const p of pairs) {
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
  const activeView = location.pathname.endsWith('/reportes') ? 'reportes' : 'general';
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
  const [planta, setPlanta] = useState<'' | Planta>('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [editHorariosOpen, setEditHorariosOpen] = useState(false);
  const [horarioEdits, setHorarioEdits] = useState<Record<string, HorarioEdit>>({});
  const [savingHorarios, setSavingHorarios] = useState(false);
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [fichajesPage, empleadosData] = await Promise.all([
        asistenciaApi.getFichajes({
          fecha: diaFecha,
          pin: pin || undefined,
          nombre: nombre.trim() || undefined,
          estado,
          planta: planta || undefined,
        }),
        asistenciaApi.getEmpleados(undefined),
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
    if (empleados.length > 0) return;
    try {
      setEmpleados(await asistenciaApi.getEmpleados(undefined));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  useEffect(() => {
    if (activeView === 'general') {
      void loadData();
    } else {
      void loadReportEmployees();
    }
  }, [activeView, diaFecha, estado, planta]);

  const onRefresh = async () => {
    await loadData();
  };

  const empleadosByPin = useMemo(() => {
    const map = new Map<string, EmpleadoAsistencia[]>();
    for (const emp of empleados) {
      const arr = map.get(emp.pin) ?? [];
      arr.push(emp);
      map.set(emp.pin, arr);
    }
    return map;
  }, [empleados]);

  const itemsMismoDiaAr = useMemo(
    () => items.filter((f) => tiempoYmdEnAr(f.tiempo) === diaFecha),
    [items, diaFecha],
  );
  const registrosFueraDelDia = items.length - itemsMismoDiaAr.length;

  const aggregates = useMemo(
    () => buildEmployeeDayAggregates(itemsMismoDiaAr),
    [itemsMismoDiaAr],
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

  const aplicarEmpleadoGrupo = async (agg: EmployeeDayAgg, empleadoId: string) => {
    const payload = empleadoId || undefined;
    try {
      await Promise.all(
        agg.fichajes.map((f) =>
          asistenciaApi.updateFichaje(f.id, { empleadoId: payload }),
        ),
      );
      toast.success('Empleado actualizado en todos los fichajes del día');
      await loadData();
      setDrafts((prev) => {
        const next = { ...prev };
        for (const f of agg.fichajes) delete next[f.id];
        return next;
      });
    } catch (err) {
      toast.error((err as Error).message);
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
          const page = await asistenciaApi.getFichajes({ fecha, planta: planta || undefined });
          const filtered = page.items.filter((f) => tiempoYmdEnAr(f.tiempo) === fecha);
          return { fecha, aggs: buildEmployeeDayAggregates(filtered) };
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
    const next: Record<string, HorarioEdit> = {};
    for (const f of itemsMismoDiaAr) {
      next[f.id] = {
        fecha: tiempoYmdEnAr(f.tiempo),
        hora: tiempoHmsEnAr(f.tiempo),
        estado: f.estado,
      };
    }
    setHorarioEdits(next);
    setEditHorariosOpen(true);
  };

  const saveHorariosModal = async () => {
    setSavingHorarios(true);
    try {
      const toPatch: { id: string; tiempo?: string; estado?: 0 | 1 }[] = [];
      for (const f of itemsMismoDiaAr) {
        const ed = horarioEdits[f.id];
        if (!ed) continue;
        const newIso = arFechaYHoraToIso(ed.fecha, ed.hora);
        const patch: { id: string; tiempo?: string; estado?: 0 | 1 } = { id: f.id };
        if (new Date(newIso).getTime() !== new Date(f.tiempo).getTime()) {
          patch.tiempo = newIso;
        }
        if (ed.estado !== f.estado) {
          patch.estado = ed.estado;
        }
        if (patch.tiempo !== undefined || patch.estado !== undefined) {
          toPatch.push(patch);
        }
      }
      if (toPatch.length === 0) {
        toast.message('No hay cambios para guardar');
        setEditHorariosOpen(false);
        return;
      }
      await Promise.all(
        toPatch.map((u) =>
          asistenciaApi.updateFichaje(u.id, { tiempo: u.tiempo, estado: u.estado }),
        ),
      );
      toast.success(`${toPatch.length} fichaje(s) actualizado(s)`);
      setEditHorariosOpen(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingHorarios(false);
    }
  };

  const fichajesModalSorted = useMemo(
    () =>
      [...itemsMismoDiaAr].sort(
        (a, b) => new Date(a.tiempo).getTime() - new Date(b.tiempo).getTime(),
      ),
    [itemsMismoDiaAr],
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">RRHH</h1>
        {activeView === 'general' && (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={openEditHorariosModal}
            disabled={loading || itemsMismoDiaAr.length === 0}
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
      </div>

      {activeView === 'general' && (
        <>
      <Dialog
        open={editHorariosOpen}
        onClose={() => !savingHorarios && setEditHorariosOpen(false)}
        title="Editar horarios de fichajes"
        description={`${formatDayHeading(diaFecha)} · hora en Argentina (−03:00). Se guardan solo las filas que cambien.`}
        panelClassName="max-w-3xl"
      >
        <div className="max-h-[min(70vh,520px)] overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Persona
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[5.5rem]">
                  Tipo
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Fecha
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Hora
                </th>
              </tr>
            </thead>
            <tbody>
              {fichajesModalSorted.map((f) => {
                const ed = horarioEdits[f.id] ?? {
                  fecha: tiempoYmdEnAr(f.tiempo),
                  hora: tiempoHmsEnAr(f.tiempo),
                  estado: f.estado,
                };
                return (
                  <tr key={f.id} className="border-b border-border/80 last:border-0">
                    <td className="px-3 py-2 align-middle">
                      <span className="font-medium text-foreground leading-snug">
                        {fichajeEmpleadoLabel(f)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <select
                        value={String(ed.estado)}
                        onChange={(e) =>
                          setHorarioEdits((prev) => {
                            const cur = prev[f.id] ?? {
                              fecha: tiempoYmdEnAr(f.tiempo),
                              hora: tiempoHmsEnAr(f.tiempo),
                              estado: f.estado,
                            };
                            return {
                              ...prev,
                              [f.id]: { ...cur, estado: Number(e.target.value) as 0 | 1 },
                            };
                          })
                        }
                        className="w-full min-w-[6.5rem] rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="0">Entrada</option>
                        <option value="1">Salida</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="date"
                        value={ed.fecha}
                        onChange={(e) =>
                          setHorarioEdits((prev) => {
                            const cur = prev[f.id] ?? {
                              fecha: tiempoYmdEnAr(f.tiempo),
                              hora: tiempoHmsEnAr(f.tiempo),
                              estado: f.estado,
                            };
                            return { ...prev, [f.id]: { ...cur, fecha: e.target.value } };
                          })
                        }
                        className="w-full min-w-[9.5rem] rounded-md border border-border bg-background px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="time"
                        step={1}
                        value={ed.hora}
                        onChange={(e) =>
                          setHorarioEdits((prev) => {
                            const cur = prev[f.id] ?? {
                              fecha: tiempoYmdEnAr(f.tiempo),
                              hora: tiempoHmsEnAr(f.tiempo),
                              estado: f.estado,
                            };
                            return { ...prev, [f.id]: { ...cur, hora: e.target.value } };
                          })
                        }
                        className="w-full min-w-[7.5rem] rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditHorariosOpen(false)}
            disabled={savingHorarios}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void saveHorariosModal()} disabled={savingHorarios}>
            {savingHorarios ? 'Guardando…' : 'Guardar cambios'}
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
          {registrosFueraDelDia > 0 && (
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {total} recibidos · {registrosFueraDelDia} otro día AR
            </p>
          )}
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
        <select
          value={planta}
          onChange={(e) => { setPlanta(e.target.value as '' | Planta); }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Todas las plantas</option>
          <option value="villa_nueva">Villa Nueva</option>
          <option value="tucuman">Tucuman</option>
        </select>
      </div>
        </>
      )}

      {activeView === 'reportes' && (
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Reporte por empleado</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_repeat(3,auto)_auto_auto] gap-3 items-end">
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
      {registrosFueraDelDia > 0 && (
        <p className="text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
          {registrosFueraDelDia} registro(s) llegaron de la API con hora en otro día (Argentina) y no se mezclan en esta tabla. Revisá datos o el filtro en backend.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Por empleado se suman todos los tramos entrada → salida del día. El saldo compara contra {HORAS_JORNADA} h. Desplegá «Fichajes» para corregir estado o guardar.
      </p>

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
              const first = agg.fichajes[0];
              const options = first ? (empleadosByPin.get(first.pin) ?? empleados) : empleados;
              const draftMain = first ? draftFor(first) : { empleadoId: '', estado: '0' as EstadoOption };
              const tieneValidos = agg.pairs.length > 0;
              const saldoMs = agg.totalMs - MS_JORNADA;
              const expanded = expandedKeys.has(agg.key);

              return (
                <tbody key={agg.key} className="border-b border-border last:border-0">
                  <tr className="hover:bg-muted/20 align-top">
                    <td className="px-5 py-5">
                      <p className="font-medium text-foreground leading-snug">{employeeDisplayLabel(agg)}</p>
                      {first && (
                        <select
                          value={draftMain.empleadoId}
                          onChange={(e) => {
                            void aplicarEmpleadoGrupo(agg, e.target.value);
                          }}
                          className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                        >
                          <option value="">Sin asociar</option>
                          {options.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName}
                            </option>
                          ))}
                        </select>
                      )}
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
                        {agg.orphanEntradas.map((f) => (
                          <div
                            key={f.id}
                            className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 whitespace-nowrap overflow-hidden text-ellipsis"
                          >
                            Entrada sin salida emparejada ·{' '}
                            <span className="font-mono">{formatSoloHora(f.tiempo)}</span>
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
    </div>
  );
}
