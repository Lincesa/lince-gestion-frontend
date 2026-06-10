import type { Planta, TipoAusencia } from '@/types';

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const TIPO_AUSENCIA_LABEL: Record<TipoAusencia, string> = {
  vacaciones: 'Vacaciones',
  compensacion: 'Compensación',
  licencia_medica: 'Licencia médica',
  permiso_direccion: 'Permiso de dirección',
  otro: 'Otro',
};

export const TIPO_AUSENCIA_EMOJI: Record<TipoAusencia, string> = {
  vacaciones: '🏖',
  compensacion: '⚖️',
  licencia_medica: '🏥',
  permiso_direccion: '📝',
  otro: '•',
};

export const TIPO_AUSENCIA_COLOR: Record<TipoAusencia, string> = {
  vacaciones: 'bg-sky-500',
  compensacion: 'bg-emerald-500',
  licencia_medica: 'bg-rose-500',
  permiso_direccion: 'bg-violet-500',
  otro: 'bg-slate-500',
};

export function plantaLabel(p: Planta): string {
  return p === 'tucuman' ? 'Tucumán' : 'Villa Nueva';
}

export function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}

export function dateToYmd(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function todayYmd(): string {
  return dateToYmd(new Date());
}

// Devuelve la grilla de días para un mes dado. Los días previos al primero del mes y posteriores
// al último vienen como `fuera = true`. Cada array dentro es una semana (L→D).
export interface CalendarCell {
  ymd: string;
  day: number;
  inMonth: boolean;
  dow: number; // 0=Lun, ..., 6=Dom (orden local)
}

export function buildMonthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // dow en JS: 0=Dom, 1=Lun, ..., 6=Sáb. Queremos columna 0 = Lun.
  const firstDow = (first.getDay() + 6) % 7;
  const totalDays = last.getDate();

  const cells: CalendarCell[] = [];
  // Días previos
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({
      ymd: dateToYmd(d),
      day: d.getDate(),
      inMonth: false,
      dow: (d.getDay() + 6) % 7,
    });
  }
  // Días del mes
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month, d);
    cells.push({
      ymd: dateToYmd(dt),
      day: d,
      inMonth: true,
      dow: (dt.getDay() + 6) % 7,
    });
  }
  // Completar última semana
  while (cells.length % 7 !== 0) {
    const lastCell = cells[cells.length - 1];
    const next = ymdToDate(lastCell.ymd);
    next.setDate(next.getDate() + 1);
    cells.push({
      ymd: dateToYmd(next),
      day: next.getDate(),
      inMonth: false,
      dow: (next.getDay() + 6) % 7,
    });
  }
  // Particionar por semanas
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function ymdInRange(ymd: string, desde: string, hasta: string): boolean {
  return ymd >= desde && ymd <= hasta;
}
