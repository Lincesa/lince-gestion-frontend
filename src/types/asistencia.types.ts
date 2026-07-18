export type Planta = 'tucuman' | 'villa_nueva';

export interface EmpleadoAsistencia {
  id: string;
  firstName: string;
  lastName: string;
  dni?: string | null;
  pin: string;
  planta: Planta;
  departamento?: string | null;
  cargo?: string | null;
  activo: boolean;
  horasEsperadasDia: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FichajeAsistencia {
  id: string;
  empleadoId: string | null;
  pin: string;
  tiempo: string;
  estado: 0 | 1;
  verify: number | null;
  deviceSn: string | null;
  planta: Planta | null;
  rawPayload: string | null;
  createdAt: string;
  empleado: EmpleadoAsistencia | null;
}

export interface FichajesPage {
  items: FichajeAsistencia[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  fecha?: string;
}

export interface FichajeReporte {
  id: string;
  tiempo: string;
  estado: 0 | 1;
}

export interface TramoReporte {
  entrada: FichajeReporte;
  salida: FichajeReporte;
  ms: number;
}

export type TipoAusencia =
  | 'vacaciones'
  | 'compensacion'
  | 'licencia_medica'
  | 'permiso_direccion'
  | 'falta_justificada'
  | 'falta_injustificada'
  | 'suspension'
  | 'otro';

export type TipoExcepcionDia = 'no_laborable' | 'laborable';

export interface DiaReporteEmpleado {
  fecha: string;
  diaHabil: boolean;
  esperadoMs: number;
  trabajadoMs: number;
  justificadoMs: number;
  saldoMs: number;
  fichajes: FichajeReporte[];
  tramos: TramoReporte[];
  entradasSinSalida: FichajeReporte[];
  salidasSinEntrada: FichajeReporte[];
  esFeriado: boolean;
  esAusencia: boolean;
  motivoNoLaborable?: string;
  tipoAusencia?: TipoAusencia;
  isHoraExtra: boolean;
  lunesAViernesMs: number;
  sabadoMs: number;
  domingoMs: number;
  feriadoMs: number;
  saldoLunesAViernesMs?: number;
  saldoSabadoMs?: number;
  saldoDomingoMs?: number;
  saldoFeriadoMs?: number;
  excedenteDiarioMs: number;
}

export interface DiaNoLaborable {
  id: string;
  fecha: string;
  plantas: Planta[];
  motivo: string;
  tipoExcepcion: TipoExcepcionDia;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AusenciaEmpleado {
  id: string;
  empleadoId: string;
  desde: string;
  hasta: string;
  tipo: TipoAusencia;
  motivo: string | null;
  horasJustificadas: number | null;
  empleado?: EmpleadoAsistencia | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PinSummaryRow {
  pin: string;
  planta: Planta;
  totalFichajes: number;
  ultimoFichaje: string | null;
  empleadoId: string | null;
  empleadoNombre: string | null;
  empleadoPlanta: Planta | null;
}

export interface ReporteEmpleadoRango {
  empleado: {
    id: string;
    pin: string;
    firstName: string;
    lastName: string;
    planta: Planta;
  };
  desde: string;
  hasta: string;
  horasEsperadasPorDia: number;
  resumen: {
    diasHabiles: number;
    diasConTramos: number;
    diasFeriado?: number;
    diasAusencia?: number;
    esperadoMs: number;
    trabajadoMs: number;
    justificadoMs: number;
    horasExtraMs?: number;
    saldoMs: number;
  };
  dias: DiaReporteEmpleado[];
}

export type MonthlyEmployeeStatus = 'ok' | 'review' | 'critical';

export interface MonthlyAttendancePunchDetail {
  id: string;
  tiempo: string;
  estado: 0 | 1;
}

export interface MonthlyAttendancePairDetail {
  entrada: MonthlyAttendancePunchDetail;
  salida: MonthlyAttendancePunchDetail;
  ms: number;
}

export interface MonthlyAttendanceDay {
  fecha: string;
  expectedMs: number;
  workedMs: number;
  justifiedMs: number;
  balanceMs: number;
  lunesAViernesMs: number;
  sabadoMs: number;
  domingoMs: number;
  feriadoMs: number;
  saldoLunesAViernesMs?: number;
  saldoSabadoMs?: number;
  saldoDomingoMs?: number;
  saldoFeriadoMs?: number;
  pairs: number;
  orphanEntradas: number;
  orphanSalidas: number;
  pairDetails: MonthlyAttendancePairDetail[];
  orphanEntradaDetails: MonthlyAttendancePunchDetail[];
  orphanSalidaDetails: MonthlyAttendancePunchDetail[];
  isWorkday: boolean;
  isJustifiedAbsence: boolean;
  isNoLaborable: boolean;
  esFeriado?: boolean;
  hasIncompletePunches: boolean;
  isUnjustifiedAbsence: boolean;
  isExtraDay: boolean;
  excedenteDiarioMs: number;
  horasExtraMs: number;
}

export interface MonthlyAttendanceEmployeeRow {
  empleadoId: string;
  pin: string;
  nombre: string;
  planta: Planta;
  departamento: string | null;
  cargo: string | null;
  diasEsperados: number;
  diasTrabajados: number;
  diasAusenciaJustificada: number;
  diasAusenteInjustificado: number;
  diasNoLaborables: number;
  diasConFichajeIncompleto: number;
  expectedMs: number;
  workedMs: number;
  justifiedMs: number;
  extraMs: number;
  lunesAViernesMs: number;
  sabadoMs: number;
  domingoMs: number;
  feriadoMs: number;
  saldoLunesAViernesMs?: number;
  saldoSabadoMs?: number;
  saldoDomingoMs?: number;
  saldoFeriadoMs?: number;
  horasExtraMs: number;
  balanceMs: number;
  cumplimientoPct: number;
  ausentismoPct: number;
  status: MonthlyEmployeeStatus;
  days: MonthlyAttendanceDay[];
}

export interface MonthlyAttendanceSummary {
  month: string;
  desde: string;
  hasta: string;
  planta: Planta | 'todas';
  totals: {
    empleados: number;
    diasEsperados: number;
    diasTrabajados: number;
    diasAusenciaJustificada: number;
    diasAusenteInjustificado: number;
    diasConFichajeIncompleto: number;
    expectedMs: number;
    workedMs: number;
    justifiedMs: number;
    extraMs: number;
    lunesAViernesMs: number;
    sabadoMs: number;
    domingoMs: number;
    feriadoMs: number;
    saldoLunesAViernesMs?: number;
    saldoSabadoMs?: number;
    saldoDomingoMs?: number;
    saldoFeriadoMs?: number;
    horasExtraMs: number;
    balanceMs: number;
    cumplimientoPct: number;
    ausentismoPct: number;
    fichajesSinEmpleado: number;
  };
  employees: MonthlyAttendanceEmployeeRow[];
}

export interface AttendanceKpis {
  month: string;
  planta: Planta | 'todas';
  cards: {
    empleados: number;
    presentismoPct: number;
    ausentismoPct: number;
    cumplimientoPct: number;
    balanceMs: number;
    fichajesSinEmpleado: number;
    diasConFichajeIncompleto: number;
  };
  byPlant: Array<{
    planta: Planta;
    empleados: number;
    expectedMs: number;
    workedMs: number;
    balanceMs: number;
    cumplimientoPct: number;
    ausentismoPct: number;
    diasConFichajeIncompleto: number;
  }>;
  weeklyTrend: Array<{
    semana: string;
    expectedMs: number;
    workedMs: number;
    balanceMs: number;
    cumplimientoPct: number;
  }>;
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    title: string;
    detail: string;
  }>;
  incompletePunches: Array<{
    empleadoId: string;
    empleadoNombre: string;
    planta: Planta;
    fecha: string;
    orphanEntradas: number;
    orphanSalidas: number;
  }>;
  topReview: MonthlyAttendanceEmployeeRow[];
}
